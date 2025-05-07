const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const { createServer } = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000
});

const port = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Serve static files from the current directory
app.use(express.static(__dirname));

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://nemzzzy:Hi123456%2E@aboutthat.mlbsvhu.mongodb.net/chat?retryWrites=true&w=majority&appName=AboutThat';

mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Exit if we can't connect to the database
});

// Message Schema
const messageSchema = new mongoose.Schema({
    text: String,
    sender: String,
    role: String,
    timestamp: { type: Date, default: Date.now }
});

// Highlight Schema
const highlightSchema = new mongoose.Schema({
    text: String,
    sender: String,
    role: String,
    timestamp: { type: Date, default: Date.now }
});

// School Message Schema
const schoolMessageSchema = new mongoose.Schema({
    text: String,
    sender: String,
    role: String,
    timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);
const Highlight = mongoose.model('Highlight', highlightSchema);
const SchoolMessage = mongoose.model('SchoolMessage', schoolMessageSchema);

// API endpoint to get messages
app.get('/api/messages', async (req, res) => {
    try {
        const messages = await Message.find().sort({ timestamp: 1 });
        console.log('Retrieved messages from MongoDB:', messages.length);
        res.json(messages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Error fetching messages' });
    }
});

// API endpoint to get highlights
app.get('/api/highlights', async (req, res) => {
    try {
        const highlights = await Highlight.find().sort({ timestamp: 1 });
        res.json(highlights);
    } catch (error) {
        console.error('Error fetching highlights:', error);
        res.status(500).json({ error: 'Error fetching highlights' });
    }
});

// API endpoint to get school messages
app.get('/api/school-messages', async (req, res) => {
    try {
        const messages = await SchoolMessage.find().sort({ timestamp: 1 });
        res.json(messages);
    } catch (error) {
        console.error('Error fetching school messages:', error);
        res.status(500).json({ error: 'Error fetching school messages' });
    }
});

// Test endpoint to verify MongoDB connection
app.get('/api/test-mongodb', async (req, res) => {
    try {
        const count = await Message.countDocuments();
        res.json({ 
            status: 'success', 
            messageCount: count,
            connection: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'error', 
            error: error.message 
        });
    }
});

// API endpoint to delete all messages
app.delete('/api/messages', async (req, res) => {
    try {
        // Check if user is owner
        const userRole = req.headers['user-role'];
        if (userRole !== 'owner') {
            return res.status(403).json({ error: 'Only owners can delete messages' });
        }

        const result = await Message.deleteMany({});
        console.log('Deleted all messages:', result);
        res.json({ 
            status: 'success', 
            deletedCount: result.deletedCount 
        });
    } catch (error) {
        console.error('Error deleting messages:', error);
        res.status(500).json({ error: 'Error deleting messages' });
    }
});

// API endpoint to delete all highlights
app.delete('/api/highlights', async (req, res) => {
    try {
        // Check if user is owner
        const userRole = req.headers['user-role'];
        console.log('Delete highlights request from role:', userRole);
        
        if (userRole !== 'owner') {
            console.log('Unauthorized delete attempt from role:', userRole);
            return res.status(403).json({ error: 'Only owners can delete highlights' });
        }

        console.log('Attempting to delete all highlights...');
        const result = await Highlight.deleteMany({});
        console.log('Delete highlights result:', result);
        
        if (result.acknowledged) {
            console.log('Successfully deleted all highlights');
            io.emit('highlights_cleared');
            res.json({ 
                status: 'success', 
                deletedCount: result.deletedCount 
            });
        } else {
            throw new Error('Delete operation not acknowledged by MongoDB');
        }
    } catch (error) {
        console.error('Error deleting highlights:', error);
        res.status(500).json({ 
            error: 'Error deleting highlights',
            details: error.message 
        });
    }
});

// API endpoint to delete all school messages
app.delete('/api/school-messages', async (req, res) => {
    try {
        // Check if user is owner
        const userRole = req.headers['user-role'];
        if (userRole !== 'owner') {
            return res.status(403).json({ error: 'Only owners can delete school messages' });
        }

        const result = await SchoolMessage.deleteMany({});
        console.log('Deleted all school messages:', result);
        io.emit('school_messages_cleared');
        res.json({ 
            status: 'success', 
            deletedCount: result.deletedCount 
        });
    } catch (error) {
        console.error('Error deleting school messages:', error);
        res.status(500).json({ error: 'Error deleting school messages' });
    }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('New client connected');

    socket.on('new_message', async (data) => {
        console.log('Received message from client:', data);
        try {
            const message = new Message({
                text: data.text,
                sender: data.sender || 'anonymous',
                role: data.role || 'user'
            });
            const savedMessage = await message.save();
            console.log('Message saved to MongoDB:', savedMessage);
            io.emit('message_received', savedMessage);
        } catch (error) {
            console.error('Error saving message:', error);
            socket.emit('error', { message: error.message || 'Error saving message' });
        }
    });

    socket.on('new_highlight', async (data) => {
        console.log('Received highlight from client:', data);
        try {
            if (!['admin', 'owner', 'highlighter'].includes(data.role)) {
                throw new Error('You do not have permission to send highlights');
            }

            const highlight = new Highlight({
                text: data.text,
                sender: data.sender || 'anonymous',
                role: data.role
            });
            const savedHighlight = await highlight.save();
            console.log('Highlight saved to MongoDB:', savedHighlight);
            io.emit('highlight_received', savedHighlight);
        } catch (error) {
            console.error('Error saving highlight:', error);
            socket.emit('error', { message: error.message || 'Error saving highlight' });
        }
    });

    socket.on('new_school_message', async (data) => {
        console.log('Received school message from client:', data);
        try {
            // Allow any role to send school messages
            const message = new SchoolMessage({
                text: data.text,
                sender: data.sender || 'anonymous',
                role: data.role || 'user'  // Default to 'user' if no role specified
            });
            const savedMessage = await message.save();
            console.log('School message saved to MongoDB:', savedMessage);
            io.emit('school_message_received', savedMessage);
        } catch (error) {
            console.error('Error saving school message:', error);
            socket.emit('error', { message: error.message || 'Error saving school message' });
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
httpServer.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
}); 
