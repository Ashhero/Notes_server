// require ("dotenv").config();

// const config = require("./config.json")
const mongoose= require("mongoose");

// mongoose.connect(config.connectionString);
const User=require("./models/user.model");

const Note=require("./models/note.model");

const express = require("express");
const cors = require("cors");
const {authenticateToken} = require("./utilities");
const app = express();
const jwt=require("jsonwebtoken");
app.use(express.json());

app.use(cors({
    origin:"*"
})
);

app.post("/create-account", async (req, res) => {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
        return res.status(400).json({ error: true, message: "All fields are required" });
    }

    const isUser = await User.findOne({ email: email });
    if (isUser) {
        return res.status(400).json({ error: true, message: "User already exists" });
    }

    const user = new User({ fullName, email, password });
    await user.save();

    const accessToken = jwt.sign({ user: user }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "36000m" });

    return res.json({ error: false, user, accessToken, message: "Registration Successful" });
});

// Login route remains the same as you already authenticate users here
app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: true, message: "Email and Password are required" });
    }

    const userInfo = await User.findOne({ email: email });
    if (!userInfo || userInfo.password !== password) {
        return res.status(400).json({ error: true, message: "Invalid Credentials" });
    }

    const accessToken = jwt.sign({ user: userInfo }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "36000m" });
    return res.json({ error: false, message: "Login Successful", email, accessToken });
});

// Get User route remains unchanged as it already checks the authenticated user
app.get("/get-user", authenticateToken, async (req, res) => {
    const { user } = req.user; // Access the user from req.user
    try {
        const isUser = await User.findById(user._id);
        if (!isUser) {
            return res.status(400).json({ error: true, message: "User not found" });
        }
        return res.json({ user: { fullName: isUser.fullName, email: isUser.email, _id: isUser._id }, message: "" });
    } catch (error) {
        return res.status(500).json({ error: true, message: "Internal Server Error" });
    }
});

// Add Note
app.post("/add-note", authenticateToken, async (req, res) => {
    const { title, content, tags } = req.body;
    const { user } = req.user;

    if (!title || !content) {
        return res.status(400).json({ error: true, message: "Title and Content are required" });
    }

    try {
        const note = new Note({
            title,
            content,
            tags: tags || [],
            userId: user._id, // Ensure the note is linked to the user
        });
        await note.save();

        return res.json({
            error: false,
            note,
            isPinned: false,
            message: "Note added successfully",
        });
    } catch (error) {
        return res.status(500).json({ error: true, message: "Internal Server Error" });
    }
});

// Edit Note (Authorization added to ensure users can only edit their own notes)
app.put("/edit-note/:noteId", authenticateToken, async (req, res) => {
    const { title, content, tags, isPinned } = req.body;
    const noteId = req.params.noteId;
    const { user } = req.user;

    if (!title && !content && !tags) {
        return res.status(400).json({ error: true, message: "No changes provided" });
    }

    try {
        const note = await Note.findOne({ _id: noteId });
        if (!note) {
            return res.status(400).json({ error: true, message: "Note not found" });
        }

        if (note.userId.toString() !== user._id.toString()) {
            return res.status(403).json({ error: true, message: "Unauthorized access" });
        }

        if (title) note.title = title;
        if (content) note.content = content;
        if (tags) note.tags = tags;
        if (isPinned !== undefined) note.isPinned = isPinned;

        await note.save();
        return res.json({ error: false, note, message: "Note updated successfully" });
    } catch (error) {
        return res.status(500).json({ error: true, message: "Internal Server Error" });
    }
});

// Delete Note (Authorization added to ensure users can only delete their own notes)
app.delete("/delete-note/:noteId", authenticateToken, async (req, res) => {
    const noteId = req.params.noteId;
    const { user } = req.user;

    try {
        const note = await Note.findOne({ _id: noteId });
        if (!note) {
            return res.status(400).json({ error: true, message: "Note not found" });
        }

        if (note.userId.toString() !== user._id.toString()) {
            return res.status(403).json({ error: true, message: "Unauthorized access" });
        }

        await Note.deleteOne({ _id: noteId });
        return res.json({ error: false, message: "Note deleted successfully" });
    } catch (error) {
        return res.status(500).json({ error: true, message: "Internal Server Error" });
    }
});

// Search Notes (Authorization added to ensure users can only search their own notes)
app.get("/search-notes", authenticateToken, async (req, res) => {
    const { query } = req.query;
    const { user } = req.user;

    if (!query) {
        return res.status(400).json({ error: true, message: "Search query is required" });
    }

    try {
        const matchingNotes = await Note.find({
            userId: user._id, // Only search notes that belong to the authenticated user
            $or: [
                { title: { $regex: new RegExp(query, "i") } },
                { content: { $regex: new RegExp(query, "i") } },
            ],
        });
        return res.json({
            error: false,
            notes: matchingNotes,
            message: "Notes matching the search query retrieved successfully",
        });
    } catch (error) {
        return res.status(500).json({ error: true, message: "Internal Server Error" });
    }
});

// Get All Notes (Authorization added to ensure users can only access their own notes)
app.get("/get-all-notes", authenticateToken, async (req, res) => {
    const { user } = req.user;

    try {
        const notes = await Note.find({ userId: user._id }).sort({ isPinned: -1 });
        return res.json({
            error: false,
            notes,
            message: "Notes fetched successfully",
        });
    } catch (error) {
        return res.status(500).json({ error: true, message: "Internal Server Error" });
    }
});
// app.listen(8000);

mongoose
  .connect(
    `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.0nxas.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority&appName=Cluster0`
    // `mongodb+srv://akashdevadiga919:j6ShctabFo2Ozdmt@cluster0.0nxas.mongodb.net/notesapp?retryWrites=true&w=majority&appName=Cluster0`
  )
  .then(() => {
    app.listen(process.env.PORT || 5000);
  })
  .catch(err => {
    console.log(err);
  });


//Search Notes
// app.get("/search-notes/",async(req,res)=>{  
//     // const {user}=req.user;
//     const {query}=req.query;
//     if(!query){
//         return res.status(400).json({
//             error:true,
//             message:"Please enter a search query"});
//         }
//         try{
//             const matchingNotes =  await Note.find({
//                 // userId:user._id,
//                 $or:[
//                     {title:{$regex:new RegExp(query,"i")}},
//                     {content:{$regex:new RegExp(query,"i")}}
//                     ],
//             });
//             return res.json({
//                 error:false,
//                 notes:matchingNotes,
//                 message:"Notes matching the search query retrieved successfully",
//                 });
//         }catch(error){
//             return res.status(500).json({
//                 error:true,
//                 message:"Internal Server Error"
//                 });
        
//     }
// })

module.exports =app;