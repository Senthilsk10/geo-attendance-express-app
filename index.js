// app.js
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

const path = require('path');

const app = express();
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Set the view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // Create a 'views' directory for EJS templates


// Connect to MongoDB
mongoose.connect('mongodb+srv://senthil3226w:senthil3226w@cluster0.xfxlssz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
//   useNewUrlParser: true,
//   useUnifiedTopology: true
}).then(() => {
  console.log('MongoDB connected...');
}).catch(err => console.log(err));

const attendanceSchema = new mongoose.Schema({
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },  // Referencing Session object
    rollNo: { type: Number, required: true },
    location: {
      type: {
        type: String, 
        enum: ['Point'],  
        required: true
      },
      coordinates: {
        type: ['Point'],
        required: true,
        validate: {
          validator: function(value) {
            return value.length === 2;
          },
          message: 'Coordinates should be an array of [longitude, latitude]'
        }
      }
    },
    ipAddress: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});


attendanceSchema.index({ location: '2dsphere' });

// Create Attendance Model
const Attendance = mongoose.model('Attendance', attendanceSchema);


const sessionSchema = new mongoose.Schema({
    name: { type: String, required: true },
    subject: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    location: {
        type: {
          type: String, 
          enum: ['Point'],  
          required: true
        },
        coordinates: {
          type: ['Point'],
          required: true,
          validate: {
            validator: function(value) {
              return value.length === 2;
            },
            message: 'Coordinates should be an array of [longitude, latitude]'
          }
        }
      },
  });
  
const Session = mongoose.model('Session', sessionSchema);
Session.index({ location: '2dsphere' });

app.get('/create-session', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'create_session.html'));
  });


app.post('/create-session', async (req, res) => {
    const { name, subject, latitude,longitude } = req.body;
    
    const newSession = new Session({
      name,
      subject,
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)] 
      }

    });
  
    try {
      const savedSession = await newSession.save();
      res.status(201).json({ message: 'Session created', sessionId: savedSession._id });
    } catch (err) {
      res.status(500).json({ message: 'Error creating session', error: err.message });
    }
  });


app.post('/attendance', async (req, res) => {
  const { sessionId, rollno,latitude, longitude, ipAddress } = req.body;
  console.log(req.body);

  const newAttendance = new Attendance({
    session:sessionId,  // This should be a valid Session ObjectId
    rollNo: rollno,
    location: {
      type: 'Point',
      coordinates: [parseFloat(longitude), parseFloat(latitude)] 
    },
    ipAddress
  });
console.log('doc: ',newAttendance);
  try {
    const savedAttendance = await newAttendance.save();
    res.status(201).json({ message: 'Attendance recorded', data: savedAttendance });
  } catch (err) {
    res.status(500).json({ message: 'Error recording attendance', error: err.message,stack: err.stack });
  }
});



app.get('/attendance/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    console.log(sessionId);
  
    try {
      // Fetch session details from the database
      const session = await Session.findById(sessionId);
    //   console.log(session);
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }
  
      // Render the attendance form EJS template and pass session data
      res.render('attendance_form', {
        sessionName: session.name,
        sessionSubject: session.subject,
        sessionId: session._id,
      });
    } catch (err) {
      res.status(500).json({ message: 'Error retrieving session', error: err.message });
    }
  });


// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
