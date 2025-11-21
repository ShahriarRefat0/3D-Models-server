require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = 3000;
const admin = require("firebase-admin");
const serviceAccount = require("./service-key.json");

//middelware

app.use(cors());
app.use(express.json());

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const verifyFirebaseToken = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({
      message: "unauthorized access.",
    });
  }
  const token = authorization.split(" ")[1];
  try {
    await admin.auth().verifyIdToken(token);

    next();
  } catch {
    res.status(401).send({
      message: "unauthorized access.",
    });
  }
};

const uri = process.env.MONGODB_URL;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const db = client.db("3Dmodel-db");
    const modelCollection = db.collection("models");
    const downloadsCollection = db.collection("downloads");

    //get data
    app.get("/models", async (req, res) => {
      const result = await modelCollection.find().toArray();
      res.send(result);
    });

    app.get("/models/:id", verifyFirebaseToken, async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await modelCollection.findOne(query);
      res.send(result);
    });

    //post data
    app.post("/models", async (req, res) => {
      const data = req.body;
      const result = await modelCollection.insertOne(data);
      res.send(result);
    });

    app.put("/models/:id", async (req, res) => {
      const id = req.params.id;
      const updateModel = req.body;
      const query = { _id: new ObjectId(id) };
      const update = {
        $set: updateModel,
      };
      const result = await modelCollection.updateOne(query, update);
      res.send(result);
    });

    //delete
    app.delete("/models/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await modelCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/myModels", verifyFirebaseToken, async (req, res) => {
      const email = req.query.email;
      const result = await modelCollection
        .find({ created_by: email })
        .toArray();
      res.send(result);
    });

    //latest 6 data
    app.get("/latest-models", async (req, res) => {
      const result = await modelCollection
        .find()
        .sort({ created_at: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    app.post("/downloads/:id", async (req, res) => {
      const data = req.body;
      const id = req.params.id;
      const result = await downloadsCollection.insertOne(data);
      const filter = { _id: new ObjectId(id) };
      const update = {
        $inc: {
          downloads: 1,
        },
      };
      const downloadsCounted = await modelCollection.updateOne(filter, update);
      res.send({ result, downloadsCounted });
    });

    app.get("/myDownloads", verifyFirebaseToken, async (req, res) => {
      const email = req.query.email;
      const result = await downloadsCollection
        .find({ download_by: email })
        .toArray();
      res.send(result);
    });

    app.get("/search", async (req, res) => {
      const search_text = req.query.search;
      const result = await modelCollection
        .find({ name: { $regex: search_text, $options: "i" } })
        .toArray();
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
