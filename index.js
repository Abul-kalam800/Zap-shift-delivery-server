require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_GATWAY);
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { default: Stripe } = require("stripe");
const { data } = require("react-router");
const app = express();

const port = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

var serviceAccount = require("./firebaseAdminprivetkey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

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
    const paymentColliction = db.collection("PaymentDB");
    const userColliction = db.collection("UserDB");
    const riderCollication = db.collection("Riders");

    //  get api

    const veriFayToken = async (req, res, next) => {
      const authHeader = req.headers.Authorization;
      console.log(authHeader);
      if (!authHeader) {
        return res.status(401).send({ message: "unauthorization not access" });
      }
      const token = authHeader.split(" ")[1];
      if (!token) {
        return res.status(401).send({ message: "unauthorization not access" });
      }
      try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.decodedToken = decodedToken;
        next();
      } catch (error) {
        return res.status(403).json({ message: "Unauthorized", error });
      }
    };

    // get user role by

    app.get("/users/role/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const user = await userColliction.findOne({ email });

        if (!user) return res.status(404).json({ message: "User not found" });

        res.json({ role: user.role });
      } catch (err) {
        res.status(500).json({ error: "Server error" });
      }
    });

    // admin make api
    // routes/userRoutes.js
    app.get("/users/search", async (req, res) => {
      try {
        const emailQuery = req.query.email;
        const regex = new RegExp(emailQuery, "i");

        const users = await userColliction
          .find({
            email: { $regex: regex }, // search by email
          })
          .limit(10)
          .toArray();

        res.send(users);
      } catch (err) {
        res.status(500).json({ error: "Server error" });
      }
    });

    // API to update user role (user <-> admin)
    app.patch("/users/role", async (req, res) => {
      try {
        // const id = req.params.id;
        // const query = {_id:new ObjectId(id)}
        const { email, role } = req.body; // role should be 'admin' or 'user'

        // Find the user by email
        const user = await userColliction.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });

        // Update the role
        const updatedUser = await userColliction.findOneAndUpdate(
          { email: email },
          { $set: { role: role } },
          { new: true } // Return the updated document
        );
        res.send(updatedUser);
      } catch (err) {
        res.status(500).json({ error: "Server error" });
      }
    });

    // user post api
    app.post("/users", async (req, res) => {
      const email = req.body.email;
      const exighits = await userColliction.findOne({ email });
      if (exighits) {
        return res.status(200).send({ message: "user Already exighets" });
      }
      const user = req.body;
      const result = await userColliction.insertOne(user);
      res.send(result);
    });

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
    // payment intent API
    app.post("/create-payment-intent", async (req, res) => {
      const amountIncens = req.body.amountIncens;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountIncens,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    // pament get APi
    app.get("/payment", async (req, res) => {
      const userEmail = req.query.email;

      try {
        const payments = await paymentColliction
          .find({ userEmail: userEmail })
          .toArray();
        res.send(payments);
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });
    //  payment API

    app.post("/payment", async (req, res) => {
      const {
        parcelId,
        userEmail,
        amount,
        currency,
        payment_method,
        transjctionId,
      } = req.body;

      const updatedPayment = await parcelCollection.updateOne(
        { _id: new ObjectId(parcelId) },
        {
          $set: {
            PaymentStatus: "Paid",
          },
        }
      );
      if (!updatedPayment)
        return res.status(404).send({ message: "Payment not found" });

      const paymentDoc = {
        parcelId,
        userEmail,
        amount,
        currency,
        payment_method,
        created_At: new Date(),
        paid_at_string: new Date().toISOString(),
        transjctionId,
      };
      const paymetResult = await paymentColliction.insertOne(paymentDoc);
      res.send({ insertedId: paymetResult.insertedId });
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

    // riders pending api
    app.get("/pending", async (req, res) => {
      try {
        const pendingRiders = await riderCollication
          .find({ status: "pending" })
          .toArray();
        res.status(200).send(pendingRiders);
      } catch (error) {
        console.error("Error fetching pending riders:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    // riders post Api
    app.post("/riders", async (req, res) => {
      const riders = req.body;
      const result = await riderCollication.insertOne(riders);
      res.send(result);
    });
    // update status
    app.patch("/riders/:id/status", async (req, res) => {
      const riderId = req.params.id;
      const { status, email } = req.body;
      const query = { _id: new ObjectId(riderId) };
      const updateDoc = {
        $set: {
          status,
        },
      };

      try {
        const result = await riderCollication.updateOne(query, updateDoc);

        if (status === "Active") {
          const userquery = { email };
          const userUpdate = {
            $set: {
              role: "rider",
            },
          };

          const userRole = await userColliction.updateOne(
            userquery,
            userUpdate
          );
          console.log(userRole);
          console.log(userRole.modifiedCount);
        }

        res.send(result);
      } catch (error) {
        console.error("Error updating rider status:", error);
        res.status(500).send("Internal Server Error.");
      }
    });

    // active riders

    app.get("/riders/active", async (req, res) => {
      try {
        const activeRiders = await riderCollication
          .find({ status: "Active" })
          .toArray();
        res.status(200).send(activeRiders);
      } catch (error) {
        console.error("Error fetching active riders:", error);
        res.status(500).send("Internal Server Error");
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
