const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;


//middlewares
app.use(cors({
    origin: [
        "http://localhost:5173",
        "https://wisdom-cca7e.web.app",
        "https://wisdom-cca7e.firebaseapp.com",
    ],
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.f46fr3f.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


//own middlewares
const logger = (req, res, next) => {
    console.log('log info here:', req.method, req.url);
    next()
}

const verifyToken = (req, res, next) => {
    const token = req?.cookies?.token;
    if (!token) {
        return res.status(401).send({ message: 'Unauthorized Access' })
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'Unauthorized Access' })
        }
        req.user = decoded;
        next()
    })
}

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const database = client.db('wisdomDB')
        const allBooksCollection = database.collection('allBooks')
        const borrowedBooksCollection = database.collection('borrowedBooks')

        //auth related api
        app.post('/jwt', async (req, res) => {
            const user = req.body
            // console.log('user for token', user);
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.cookie('token', token, {
                httpOnly: true,
                secure: true,
                sameSite: 'none'
            })
                .send({ success: true })
        })

        app.post('/logout', async (req, res) => {
            const user = req.body
            console.log('logging out user:', user);
            res.clearCookie('token', { maxAge: 0 }).send({ success: true })
        })

        app.post('/all-books',logger, verifyToken, async (req, res) => {
            const book = req.body
            // console.log(req.query.email);
            // console.log('token owner info', req.user);
            if (req.user.email !== req.query.email) {
                return res.status(403).send({ message: 'forbidden Access' })
            }
            const result = await allBooksCollection.insertOne(book)
            res.send(result)
        })


        app.get('/update-books/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await allBooksCollection.findOne(query)
            res.send(result)
        })

        app.put('/update-books/:id', async (req, res) => {
            const id = req.params.id
            const updatedBook = req.body
            console.log(updatedBook)
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    bookName: updatedBook.bookName,
                    image: updatedBook.image,
                    category: updatedBook.category,
                    author: updatedBook.author,
                    rating: updatedBook.rating,
                }
            }
            const result = await allBooksCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })

        app.get('/books-category/:category', async (req, res) => {
            const category = req.params.category
            // console.log(category);
            const query = { category: category }
            const result = await allBooksCollection.find(query).toArray()
            res.send(result)
        })

        app.get('/book-details/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await allBooksCollection.findOne(query)
            res.send(result)
        })

        app.post('/borrow-book', async (req, res) => {
            const borrowedPerson = req.body
            const borrowedBookId = borrowedPerson.borrowedBookId
            const borrowedPersonEmail = borrowedPerson.borrowedPersonEmail
            console.log(borrowedBookId);
            const query = { $and: [{ borrowedBookId: borrowedBookId }, { borrowedPersonEmail: borrowedPersonEmail }] }

            const verifyBorrowedBooks = await borrowedBooksCollection.findOne(query)
            console.log(verifyBorrowedBooks);
            if (verifyBorrowedBooks === null) {
                const result = await borrowedBooksCollection.insertOne(borrowedPerson)
                res.send(result)
            }
            else {
                res.send({ bookAlreadyHas: true })
            }

        })

        app.put('/all-books/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            if (req.body?.return === 'return') {
                const result = await allBooksCollection.updateOne(query, { $inc: { quantity: +1 } })
                res.send(result)
            }
            else {
                const result = await allBooksCollection.updateOne(query, { $inc: { quantity: -1 } })
                res.send(result)
            }
        })

        app.get('/borrowed-books', async (req, res) => {
            const email = req.query.email
            const query = { borrowedPersonEmail: email }
            const result = await borrowedBooksCollection.find(query).toArray()
            res.send(result)
        })

        app.delete('/borrowed-books', async (req, res) => {
            const borrowedId = req.query.borrowedId
            const email = req.query.email
            const query = { _id: new ObjectId(borrowedId) }
            const result = await borrowedBooksCollection.deleteOne(query)
            res.send(result)
        })

        app.get('/all-books', logger, verifyToken, async (req, res) => {
            console.log(req.query.email);
            console.log('token owner info', req.user);
            if (req.user.email !== req.query.email) {
                return res.status(403).send({ message: 'forbidden Access' })
            }
            const result = await allBooksCollection.find().toArray()
            res.send(result)
        })

        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('wisdom is running')
})

app.listen(port, () => {
    console.log('wisdom server is running on port: ', port);
})