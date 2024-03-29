const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
require('dotenv').config()
const { ObjectId } = require('mongodb');
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 5000;
//stripe


app.use(cors(
  {
    origin: [
      'http://localhost:5173',
      'https://house-hunter-client.web.app/',
      `https://house-hunter-client.firebaseapp.com/`,
    ],
    credentials: true
  }
));
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.moucvko.mongodb.net/?retryWrites=true&w=majority`;

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

    //collections
    const userCollection = client.db("hunterDB").collection("user");
    const apartmentCollection = client.db("hunterDB").collection("apartments");
    const agreementCollection = client.db("hunterDB").collection("agreements");
    const announcementCollection = client.db("hunterDB").collection("announcements");
  

    // jwt related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    })
    // middlewares 
    const verifyToken = (req, res, next) => {
      console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
      })
    }

    // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }


    // user related api
    app.get('/user', verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    //admin show
    app.get('/user/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin });
    })


    // Check User 
    app.put('/user', async (req, res) => {
        try {
            const data = req.body;
            const query = { email: data.email, password: data.password };
            const result = await userCollection.findOne(query);
            
            res.send(result);
        } catch (err) {
            console.log(err);
        }
    })


    app.post('/user', async (req, res) => {
      const user = req.body;
      // insert email if user doesnt exists: 
      // you can do this many ways (1. email unique, 2. upsert 3. simple checking)
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null })
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    //make admin
    // admin email: arif@gmail.com password: Arif12@

    app.patch('/user/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    //make member
    app.patch('/user/member/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'member'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    //make member using email
    app.patch('/user/:email', verifyToken, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const updatedDoc = {
        $set: {
          role: 'member'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })


    //Remove member set to user
    app.patch('/user/user/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'user'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })



    //member show
    app.get('/user/member/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let member = false;
      if (user) {
        member = user?.role === 'member';
      }
      res.send({ member });
    })


    //delete user
    app.delete('/user/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await userCollection.deleteOne(query);
      res.send(result);
    })

    //announcement part
    app.post('/announcements', verifyToken, verifyAdmin, async (req, res) => {
      const announcementItem = req.body;
      const result = await announcementCollection.insertOne(announcementItem);
      res.send(result);
    })

    app.get('/announcements', async (req, res) => {
      const result = await announcementCollection.find().toArray();
      res.send(result);
    })



    //agreement parts

    app.get('/agreements', async (req, res) => {

      const result = await agreementCollection.find().toArray();
      res.send(result);
    })



    app.post('/agreements', async (req, res) => {
      const agreementItem = req.body;
      const result = await agreementCollection.insertOne(agreementItem);
      res.send(result);
    });

    app.patch('/agreements/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const item = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: item.status,
          acceptDate: item.acceptDate
        }
      }
      const result = await agreementCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })



    //apartment parts
    app.get('/apartments', async (req, res) => {
      const result = await apartmentCollection.find().toArray();
      res.send(result);
    })
  //add new apartment
    app.post('/apartments', async (req, res) => {
        const Item = req.body;
        const result = await agreementCollection.insertOne(Item);
        res.send(result);
      });


    app.get('/apartments/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await apartmentCollection.findOne(query);
      res.send(result);
    })

    app.patch('/apartments/apartment/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const item = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: item.status,
          userEmail: item.userEmail
        }
      }
      const result = await apartmentCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    //user part 
    app.get('/user', verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });


    app.post('/user', async (req, res) => {
      const user = req.body;
      // insert email if user doesnt exists: 
      // you can do this many ways (1. email unique, 2. upsert 3. simple checking)
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null })
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // //payment part
    // app.get('/payments/:email', verifyToken, async (req, res) => {
    //   const query = { email: req.params.email }
    //   if (req.params.email !== req.decoded.email) {
    //     return res.status(403).send({ message: 'forbidden access' });
    //   }
    //   const result = await paymentCollection.find(query).toArray();
    //   res.send(result);
    // })



    // app.post('/payments', async (req, res) => {
    //   const paymentItem = req.body;
    //   const result = await paymentCollection.insertOne(paymentItem);
    //   res.send(result);
    // });




    // Connect the client to the server	(optional starting in v4.7)
    //await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('hunter is sitting')
})

app.listen(port, () => {
  console.log(`house hunter is sitting on port ${port}`);
})
