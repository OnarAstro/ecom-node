const PORT = process.env.PORT || 4000;
const URL = process.env.BASE_URL;

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const { connect } = require("http2");
const dotenv = require("dotenv");
const { error } = require("console");

app.use(express.json());
app.use(cors());

dotenv.config();


// Database Connection with Mongodb
mongoose.connect(process.env.MONGODB_URL);

// Api creation
app.get("/", (req, res) => {
  res.send("Backend API is running");
})


// Image storage ragine
const storage = multer.diskStorage({
  destination: "./upload/images",
  filename: (req, file, cb) => {
    return cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`)
  }
})

const upload = multer({storage: storage})
// creating uplload endpoint for images
app.use('/images', express.static("upload/images"))
app.post("/upload", upload.single("product"), (req, res) => {

  const ImageUrl = `${URL}/images/${req.file.filename}`;

  res.json({
    success: true,
    image_url: ImageUrl
  })
})

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

// Endpoint لجلب بيانات المستخدم
app.get("/getuser", fetchUser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    res.json({ success: true, name: user.name });
  } catch (error) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});


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


app.listen(PORT, (error) => {
  if (!error) {
    console.log("Server is running on port: ", PORT);
  } else {
    console.log("Error: ", error);
  }
})



