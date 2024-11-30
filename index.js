const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const dotenv = require("dotenv");
const cloudinary = require("cloudinary").v2;

dotenv.config();

// إعداد Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET
});

const app = express();
app.use(express.json());
app.use(cors());

// Database Connection with MongoDB
mongoose.connect(process.env.MONGODB_URL);

// Image storage configuration (استخدام memory storage بدلاً من diskStorage)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Routes

app.get("/", (req, res) => {
  res.send("Backend API is running");
});

// Endpoint لرفع الصور
app.post("/upload", upload.single("product"), (req, res) => {
  cloudinary.uploader.upload_stream((error, result) => {
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    res.json({
      success: true,
      image_url: result.secure_url, // URL الصورة المحفوظة في Cloudinary
    });
  }).end(req.file.buffer);
});

// Schema لتعريف المنتجات
const Product = mongoose.model("Product", {
  id: {
    type: Number,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  image: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
  },
  new_price: {
    type: Number,
    required: true
  },
  old_price: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  available: {
    type: Boolean,
    default: true
  },
});

// API لإضافة منتجات
app.post("/addproduct", async (req, res) => {
  let products = await Product.find({});
  let id;
  if (products.length > 0) {
    let last_product_array = products.slice(-1);
    let last_product = last_product_array[0];
    id = last_product.id + 1;
  } else {
    id = 1;
  }

  const product = new Product({
    id: id,
    name: req.body.name,
    image: req.body.image,
    category: req.body.category,
    new_price: req.body.new_price,
    old_price: req.body.old_price,
  });

  await product.save();
  res.json({
    success: true,
    name: req.body.name,
  });
});

// API لحذف المنتج
app.post("/removeproduct", async (req, res) => {
  await Product.findOneAndDelete({ id: req.body.id });
  res.json({
    success: true,
    name: req.body.name,
  });
});

// API للحصول على جميع المنتجات
app.get("/allproducts", async (req, res) => {
  let products = await Product.find({});
  res.send(products);
});

// Schema لنموذج المستخدم
const User = mongoose.model("User", {
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true
  },
  cartData: {
    type: Object,
  },
  date: {
    type: Date,
    default: Date.now
  },
});

// API لتسجيل المستخدم
app.post("/signup", async (req, res) => {
  let check = await User.findOne({ email: req.body.email });
  if (check) {
    return res.status(400).json({ success: false, error: "Existing user found with same email address" });
  }

  let cart = {};
  for (let i = 0; i < 300; i++) {
    cart[i] = 0;
  }

  const user = new User({
    name: req.body.username,
    email: req.body.email,
    password: req.body.password,
    cartData: cart,
  });

  await user.save();

  const data = {
    user: {
      id: user.id
    }
  };
  const token = jwt.sign(data, "secret_ecom");
  res.json({ success: true, token });
});

// API لتسجيل الدخول
app.post("/login", async (req, res) => {
  let user = await User.findOne({ email: req.body.email });
  if (user) {
    const passMatch = req.body.password === user.password;
    if (passMatch) {
      const data = {
        user: {
          id: user.id
        }
      };
      const token = jwt.sign(data, "secret_ecom");
      res.json({ success: true, token });
    } else {
      res.json({ success: false, errors: "Wrong Password" });
    }
  } else {
    res.json({ success: false, errors: "Wrong Email address" });
  }
});

// Middleware لاستخراج المستخدم
const fetchUser = async (req, res, next) => {
  const token = req.header("auth-token");
  if (!token) {
    res.status(401).send({ error: "Please authenticate using a valid login" });
  } else {
    try {
      const data = jwt.verify(token, "secret_ecom");
      req.user = data.user;
      next();
    } catch (error) {
      res.status(401).send({ error: "Please authenticate using a valid token" });
    }
  }
};

// API لإضافة منتجات إلى السلة
app.post("/addtocart", fetchUser, async (req, res) => {
  let userData = await User.findOne({ _id: req.user.id });
  userData.cartData[req.body.itemId] += 1;
  await User.findOneAndUpdate({ _id: req.user.id }, { cartData: userData.cartData });
  res.send("Added");
});

// API لإزالة منتج من السلة
app.post("/removefromcart", fetchUser, async (req, res) => {
  let userData = await User.findOne({ _id: req.user.id });
  if (userData.cartData[req.body.itemId] > 0)
    userData.cartData[req.body.itemId] -= 1;
  await User.findOneAndUpdate({ _id: req.user.id }, { cartData: userData.cartData });
  res.send("Removed");
});

// API للحصول على بيانات السلة
app.post("/getcart", fetchUser, async (req, res) => {
  let userData = await User.findOne({ _id: req.user.id });
  res.json(userData.cartData);
});

// تصدير التطبيق كوظيفة لخادم (Serverless Function)
module.exports = app;
