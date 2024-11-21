const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)

//middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zzqeakj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // await client.connect();


    const jewelryCollection = client.db("jewelryDB").collection("jewelries");
    const userCollection = client.db("jewelryDB").collection("users");
    const cartCollection = client.db("jewelryDB").collection("carts");
    const paymentCollection = client.db("jewelryDB").collection("payments");
    const wishlistCollection = client.db("jewelryDB").collection("wishlist");


    //all product show
    app.get('/jewelries', async (req, res) => {
      const cursor = jewelryCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    })

    //product details show by id
    app.get('/jewelries/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jewelryCollection.findOne(query);
      res.send(result);
    })

    //add products
    app.post('/jewelries', async (req, res) => {
      const jewelryItem = req.body;
      const result = await jewelryCollection.insertOne(jewelryItem);
      res.send(result);
    });

    //update
    app.patch('/jewelries/:id', async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          name: item.name,
          category: item.category,
          price: item.price,
          availability: item.availability,
          image: item.image
        }
      }
      const result = await jewelryCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })


    //product delete by id
    app.delete('/jewelries/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jewelryCollection.deleteOne(query);
      res.send(result);
    })

    //shop by category
    app.get("/jewelry/:category", async (req, res) => {
      const category = req.params.category;
      const query = { category: category };
      const result = await jewelryCollection.find(query).toArray();
      res.send(result);
    });


    // create add to shopping cart
    app.post("/carts", async (req, res) => {
      const cartsItem = req.body;
      const result = await cartCollection.insertOne(cartsItem);
      res.send(result);
    });

    //show carts products
    app.get('/carts', async (req, res) => {
      const email = req.query.email;
      const query = { email: email }
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    })

    //delete carts products
    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    })

    // create add to wishlist
    app.post("/wishlist", async (req, res) => {
      const wishlistItem = req.body;
      const result = await wishlistCollection.insertOne(wishlistItem);
      res.send(result);
    });

    //show wishlist products
    app.get('/wishlist', async (req, res) => {
      const email = req.query.email;
      const query = { email: email }
      const result = await wishlistCollection.find(query).toArray();
      res.send(result);
    })

    //delete wishlist products
    app.delete('/wishlist/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await wishlistCollection.deleteOne(query);
      res.send(result);
    })


    //show all users in admin page
    app.get("/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    })

    //delete users from admin page
    app.delete('/users/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await userCollection.deleteOne(query);
      res.send(result);
    })

    // any user or seller to admin
    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'Admin'
        }
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result)
    })


    // Make user a Seller
    app.patch('/users/make-seller/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'Seller'
        }
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Downgrade seller to normal user (reset role)
    app.patch('/users/downgrade-to-user/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'User'
        }
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });



    //isAdmin
    app.get('/users/admin/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'Admin'
      };
      res.send({ admin });
    })



    // create user public and if user login with google, default role will be user
    app.post("/users", async (req, res) => {
      const userInfo = req.body;
      const query = { email: userInfo.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null })
      }
      userInfo.role = userInfo.role || "user";
      const result = await userCollection.insertOne(userInfo);
      res.send(result);
    });



    //Payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    });

    //create payment info to database
    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      //  carefully delete each item from the cart
      const query = {
        _id: {
          $in: payment.cartIds.map(id => new ObjectId(id))
        }
      };

      const deleteResult = await cartCollection.deleteMany(query);
      res.send({ paymentResult, deleteResult });
    })



     //payment history for admin
     app.get('/payments', async (req, res) => {
      const result = await paymentCollection.find().toArray();
      res.send(result);
    })


    //payment history for users
    app.get('/payments/:email', async (req, res) => {
      const query = { email: req.params.email }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    })


    //update transaction status
    app.patch('/payments/approve/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: 'paid'
        }
      };
      const result = await paymentCollection.updateOne(filter, updateDoc);
      res.send(result);
    });


    //isSeller
    app.get('/users/seller/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let seller = false;
      if (user) {
        seller = user?.role === 'Seller'
      };
      res.send({ seller });
    })


    
    //payment history for sellers
    app.get('/payments/seller/:email', async (req, res) => {
      const email = req.params.email;
      const paymentQuery = { sellerEmail: email }; 
      const result = await paymentCollection.find(paymentQuery).toArray(); 
      res.send(result);
    });
    


    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Jewelry Shop IS RUNNING');
})

app.listen(port, () => {
  console.log(`Jewelry Shop is running on port, ${port}`);
})  