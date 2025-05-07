# AboutThat Chat Application

A real-time chat application with role-based access control and multiple chat rooms.

## Features
- Real-time messaging
- Role-based access control (Admin, Owner, Teacher, Highlighter)
- Multiple chat rooms (Main, Highlights, School)
- MongoDB integration for message persistence

## Deployment on Render

1. Fork this repository to your GitHub account
2. Go to [Render Dashboard](https://dashboard.render.com)
3. Click "New +" and select "Web Service"
4. Connect your GitHub repository
5. Configure the service:
   - Name: aboutthat (or your preferred name)
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `node server.js`
   - Add Environment Variables:
     - `MONGODB_URI`: Your MongoDB connection string
     - `PORT`: 3000 (or your preferred port)

## Environment Variables
- `MONGODB_URI`: MongoDB connection string
- `PORT`: Server port (default: 3000)

## Local Development
1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env` file with required environment variables
4. Start the server: `node server.js`
5. Open `http://localhost:3000` in your browser 