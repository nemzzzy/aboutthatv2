class ChatStorage {
    constructor() {
        this.messages = [];
        this.highlights = [];
        this.schoolMessages = [];
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.initializeSocket();
    }

    initializeSocket() {
        try {
            console.log('Initializing socket connection...');
            this.socket = io(window.location.origin, {
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: this.maxReconnectAttempts,
                reconnectionDelay: 1000,
                timeout: 20000,
                forceNew: true
            });
            this.setupSocketListeners();
        } catch (error) {
            console.error('Failed to initialize socket:', error);
            this.handleConnectionError(error);
        }
    }

    handleConnectionError(error) {
        console.error('Connection error:', error);
        this.connected = false;
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => this.initializeSocket(), 2000);
        } else {
            alert('Unable to connect to the server. Please refresh the page.');
        }
    }

    setupSocketListeners() {
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.connected = true;
            this.reconnectAttempts = 0;
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.connected = false;
            this.handleConnectionError(new Error('Disconnected from server'));
        });

        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            this.handleConnectionError(error);
        });

        this.socket.on('message_received', (message) => {
            console.log('Message received:', message);
            if (!this.messages.some(m => m._id === message._id)) {
                this.messages.push(message);
                const isAdmin = message.role === 'admin';
                const isOwner = message.role === 'owner';
                const isTeacher = message.role === 'teacher';
                const isHighlighter = message.role === 'highlighter';
                addMessageToChat(message.text, isAdmin, isOwner, isTeacher, isHighlighter);
            }
        });

        this.socket.on('school_message_received', (message) => {
            console.log('School message received:', message);
            if (!this.schoolMessages.some(m => m._id === message._id)) {
                this.schoolMessages.push(message);
                addSchoolMessageToChat(message.text, message.role === 'teacher');
            }
        });

        this.socket.on('highlight_received', (highlight) => {
            console.log('Highlight received:', highlight);
            if (!this.highlights.some(h => h._id === highlight._id)) {
                this.highlights.push(highlight);
                addHighlightToChat(highlight.text);
            }
        });

        this.socket.on('highlights_cleared', () => {
            console.log('All highlights cleared');
            this.highlights = [];
            document.getElementById('highlights-container').innerHTML = '';
        });

        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            alert(`Error: ${error.message || 'An error occurred'}`);
        });
    }

    async init() {
        try {
            console.log('Initializing chat storage...');
            const [messagesResponse, highlightsResponse, schoolMessagesResponse] = await Promise.all([
                fetch('/api/messages'),
                fetch('/api/highlights'),
                fetch('/api/school-messages')
            ]);

            if (!messagesResponse.ok) throw new Error('Failed to fetch messages');
            if (!highlightsResponse.ok) throw new Error('Failed to fetch highlights');
            if (!schoolMessagesResponse.ok) throw new Error('Failed to fetch school messages');

            this.messages = await messagesResponse.json();
            this.highlights = await highlightsResponse.json();
            this.schoolMessages = await schoolMessagesResponse.json();
            
            console.log('Loaded messages:', this.messages);
            console.log('Loaded highlights:', this.highlights);
            console.log('Loaded school messages:', this.schoolMessages);
            
            return {
                messages: this.messages,
                highlights: this.highlights,
                schoolMessages: this.schoolMessages
            };
        } catch (error) {
            console.error('Error initializing chat storage:', error);
            return { messages: [], highlights: [], schoolMessages: [] };
        }
    }

    async saveMessage(message) {
        if (!this.connected) {
            console.error('Not connected to server');
            throw new Error('Not connected to server. Please wait for connection to be established.');
        }
        
        return new Promise((resolve, reject) => {
            console.log('Sending message:', message);
            const userRole = localStorage.getItem('userRole') || 'user';
            const messageData = {
                text: message,
                role: userRole,
                sender: localStorage.getItem('username') || 'anonymous'
            };
            
            this.socket.emit('new_message', messageData, (error) => {
                if (error) {
                    console.error('Error sending message:', error);
                    reject(error);
                } else {
                    console.log('Message sent successfully');
                    resolve(messageData);
                }
            });
        });
    }

    async saveHighlight(message) {
        if (!this.connected) {
            console.error('Not connected to server');
            throw new Error('Not connected to server. Please wait for connection to be established.');
        }
        
        const userRole = localStorage.getItem('userRole');
        if (!['admin', 'owner', 'highlighter'].includes(userRole)) {
            throw new Error('You do not have permission to send highlights');
        }

        return new Promise((resolve, reject) => {
            console.log('Sending highlight:', message);
            const messageData = {
                text: message,
                role: userRole,
                sender: localStorage.getItem('username') || 'anonymous'
            };
            
            this.socket.emit('new_highlight', messageData);

            // Set up a one-time listener for the response
            const handleHighlightResponse = (savedHighlight) => {
                console.log('Highlight saved:', savedHighlight);
                resolve(savedHighlight);
            };

            const handleError = (error) => {
                console.error('Error from server:', error);
                reject(new Error(error.message || 'Error sending highlight'));
                this.socket.off('highlight_received', handleHighlightResponse);
                this.socket.off('error', handleError);
            };

            this.socket.once('highlight_received', handleHighlightResponse);
            this.socket.once('error', handleError);

            // Set a timeout in case we don't get a response
            setTimeout(() => {
                this.socket.off('highlight_received', handleHighlightResponse);
                this.socket.off('error', handleError);
                reject(new Error('Timeout waiting for server response'));
            }, 5000);
        });
    }

    async saveSchoolMessage(message) {
        if (!this.connected) {
            console.error('Not connected to server');
            throw new Error('Not connected to server. Please wait for connection to be established.');
        }
        
        return new Promise((resolve, reject) => {
            console.log('Sending school message:', message);
            const userRole = localStorage.getItem('userRole') || 'user';
            const messageData = {
                text: message,
                role: userRole,
                sender: localStorage.getItem('username') || 'anonymous'
            };
            
            this.socket.emit('new_school_message', messageData);

            // Set up a one-time listener for the response
            const handleSchoolMessageResponse = (savedMessage) => {
                console.log('School message saved:', savedMessage);
                resolve(savedMessage);
            };

            const handleError = (error) => {
                console.error('Error from server:', error);
                reject(new Error(error.message || 'Error sending school message'));
                this.socket.off('school_message_received', handleSchoolMessageResponse);
                this.socket.off('error', handleError);
            };

            this.socket.once('school_message_received', handleSchoolMessageResponse);
            this.socket.once('error', handleError);

            // Set a timeout in case we don't get a response
            setTimeout(() => {
                this.socket.off('school_message_received', handleSchoolMessageResponse);
                this.socket.off('error', handleError);
                reject(new Error('Timeout waiting for server response'));
            }, 5000);
        });
    }

    getMessages() {
        return this.messages;
    }

    getHighlights() {
        return this.highlights;
    }

    getSchoolMessages() {
        return this.schoolMessages;
    }
}

// Initialize chat storage when the page loads
console.log('Starting chat application...');
const chatStorage = new ChatStorage();
chatStorage.init().then(({ messages, highlights, schoolMessages }) => {
    console.log('Chat storage initialized');
    messages.forEach(message => {
        const isAdmin = message.role === 'admin';
        const isOwner = message.role === 'owner';
        const isTeacher = message.role === 'teacher';
        const isHighlighter = message.role === 'highlighter';
        addMessageToChat(message.text, isAdmin, isOwner, isTeacher, isHighlighter);
    });
    highlights.forEach(highlight => {
        addHighlightToChat(highlight.text);
    });
    schoolMessages.forEach(message => {
        addSchoolMessageToChat(message.text, message.role === 'teacher');
    });
});

// Update the sendMessage function to use the new storage
async function sendMessage() {
    const messageInput = document.getElementById('message-input');
    const message = messageInput.value.trim();
    
    if (message) {
        try {
            await chatStorage.saveMessage(message);
            messageInput.value = '';
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Error sending message. Please try again.');
        }
    }
} 