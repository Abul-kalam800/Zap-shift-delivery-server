require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_GATWAY);
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { default: Stripe } = require("stripe");
const app = express();

const port = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// MongoDB connection

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.icyvogv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const db = client.db("zap-shift");
    const parcelCollection = db.collection("parcel");
    //  get api

    app.get("/parcels", async (req, res) => {
      try {
        const userEamil = req.query.email;
        const query = userEamil
          ? {
              created_by: userEamil,
            }
          : {};
        const options = {
          sort: { createdAt: -1 },
        };

        // Match the correct field: created_by_email
        const result = await parcelCollection.find(query, options).toArray();

        res.send(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // single specefic api

    app.get("/parcels/:id", async (req, res) => {
      const id = req.params.id;
      const specefic = { _id: new ObjectId(id) };
      const result = await parcelCollection.findOne(specefic);
      res.send(result);
    });
    app.post("/create-payment-intent", async (req, res) => {
      const amountIncens = req.body.amountIncens;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountIncens,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });
    // post Api
    app.post("/parcels", async (req, res) => {
      try {
        const parcel = req.body;
        const result = await parcelCollection.insertOne(parcel);
        res.send(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    // delet api

    app.delete("/parcels/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const result = await parcelCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.send(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// GET: Retrieve all parcels
app.get("/", (req, res) => {
  res.send("Parcel server is rouning");
});

// Server listen
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
