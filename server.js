const port = process.env.PORT || 4000; // استخدام PORT من البيئة
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
require("dotenv").config(); // تأكد من تحميل المتغيرات البيئية

app.use(express.json());
app.use(cors());

// Database Connection with MongoDB
mongoose.connect(process.env.MONGODB_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

// Image storage configuration
const storage = multer.memoryStorage(); // استخدام التخزين في الذاكرة
const upload = multer({ storage: storage });

// API creation
app.get("/", (req, res) => {
  res.send("Backend API is running");
});

// Upload endpoint
app.post("/upload", upload.single("product"), (req, res) => {
  // هنا يمكنك إضافة منطق لتحميل الصورة إلى خدمة تخزين سحابية
  res.json({
    success: true,
    image_url: `http://localhost:${port}/images/${req.file.filename}` // يجب تعديل هذا حسب التخزين السحابي
  });
});


// Schema for creating products
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
})

// creating api for add products

app.post("/addproduct", async (req, res) => {
  let products = await Product.find({});
  let id;
  if(products.length > 0) {
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
  console.log(product);
  await product.save();
  console.log("Saved");
  res.json({
    success: true,
    name: req.body.name,
  })
})

// creating api for add products
app.post("/removeproduct", async(req, res) => {
  await Product.findOneAndDelete({id: req.body.id})
  console.log("Removed");
  res.json({
    success: true,
    name: req.body.name,
  })
})

// creating api for get products
app.get("/allproducts", async(req, res) => {
  let products = await Product.find({});
  console.log("All products Fetched");
  res.send(products);
})

// Schema user model
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
})

// Creating endpoint for registering the user
app.post("/signup", async (req, res) => {
  let check = await User.findOne({ email: req.body.email });
  if (check) {
    return res.status(400).json({ success: false, error: "Existing user found with same email address" });
  }
  let cart = {};
  for (let i = 0; i < 300; i++) {
    cart[i] = 0;
  }
  const user = new User ({
    name: req.body.username,
    email: req.body.email,
    password: req.body.password,
    cartData: cart,
  })
  await user.save();

  const data = {
    user: {
      id: user.id
    }
  }
  const token = jwt.sign(data, "secret_ecom");
  res.json({success: true, token});
})

// creating endpoint for user login
app.post("/login", async (req, res) => {
  let user = await User.findOne({ email: req.body.email });
  if (user) {
    const passMatch = req.body.password === user.password;
    if(passMatch){
      const data = {
        user: {
          id: user.id
        }
      }
      const token = jwt.sign(data, "secret_ecom");
      res.json({success: true, token});
    } else {
      res.json({success: false, errors: "Wrong Password"});
    }
  } else {
    res.json({success:false, errors:"Wrong Email address"})
  }

})

// creating endpoint for latest products
app.get("/newcollections", async (req, res) => {
  let products = await Product.find({});
  let newcollection = products.slice(1).slice(-8);
  console.log("New Collection Fetched");
  res.send(newcollection);
})

// creating endpoint for popular products
app.get("/popularproducts", async (req, res) => {
  let products = await Product.find({category: "men"});
  let popularproducts = products.slice(0, 4);
  console.log("Popular products Fetched");
  res.send(popularproducts);
})



// creating middleware to fetch user
const fetchUser = async (req, res, next) => {
  const token = req.header("auth-token");
  if(!token) {
    res.status(401).send({error: "Please authenticate using a valid login"});
  } else {
    try {
      const data = jwt.verify(token, "secret_ecom");
      req.user = data.user;
      next();
    } catch (error) {
      res.status(401).send({error: "Please authenticate using a valid token"});
    }
  }
}


// creating endpoint for adding products in cartdata
app.post("/addtocart", fetchUser, async (req, res) => {
  console.log("Added", req.body.itemId);
  let userData = await User.findOne({ _id: req.user.id });
  userData.cartData[req.body.itemId] += 1;
  await User.findOneAndUpdate({ _id: req.user.id }, { cartData: userData.cartData });
  res.send("Added");
})

// creating endpoint for removing cartData
app.post("/removefromcart", fetchUser, async (req, res) => {
  console.log("Removed", req.body.itemId);
  let userData = await User.findOne({ _id: req.user.id });
  if (userData.cartData[req.body.itemId] > 0)
    userData.cartData[req.body.itemId] -= 1;
    await User.findOneAndUpdate({ _id: req.user.id }, { cartData: userData.cartData });
  res.send("Removed");
})

// creating endpoint to get cart data
app.post("/getcart", fetchUser, async (req, res) => {
  console.log("Get cart");
  let userData = await User.findOne({ _id: req.user.id });
  res.json(userData.cartData);
})


// Start server
app.listen(port, () => {
  console.log("Server is running on port: ", port);
});