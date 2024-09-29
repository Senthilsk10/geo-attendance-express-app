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
sessionSchema.index({ location: '2dsphere' });

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
  // console.log(req.body);

  const newAttendance = new Attendance({
    session:sessionId,  // This should be a valid Session ObjectId
    rollNo: rollno,
    location: {
      type: 'Point',
      coordinates: [parseFloat(longitude), parseFloat(latitude)] 
    },
    ipAddress
  });
// console.log('doc: ',newAttendance);
  try {
    const savedAttendance = await newAttendance.save();
    res.status(201).json({ message: 'Attendance recorded', data: savedAttendance });
  } catch (err) {
    res.status(500).json({ message: 'Error recording attendance', error: err.message,stack: err.stack });
  }
});



app.get('/attendance/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
  
    try {
      const session = await Session.findById(sessionId);
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }
      res.render('attendance_form', {
        sessionName: session.name,
        sessionSubject: session.subject,
        sessionId: session._id,
      });
    } catch (err) {
      res.status(500).json({ message: 'Error retrieving session', error: err.message });
    }
  });


  const earthRadiusInMeters = 6371000;

app.get('/session/:sessionId', async (req, res) => {
  try {
    const sessionId =new  mongoose.Types.ObjectId(req.params.sessionId);
    const radiusInMeters = 10; 

    const referenceDoc = await Attendance.findOne({ session: sessionId });

    if (!referenceDoc || !referenceDoc.location || !referenceDoc.location.coordinates) {
      return res.sendFile(path.join(__dirname, 'public', 'error.html'));
    }

    const [refLongitude, refLatitude] = referenceDoc.location.coordinates;
    const refIpAddress = referenceDoc.ipAddress;

    const withinDifferentIp = await Attendance.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [refLongitude, refLatitude] },
          distanceField: 'distance',
          maxDistance: radiusInMeters,
          spherical: true,
          query: { session: sessionId, ipAddress: { $ne: refIpAddress } } 
        }
      }
    ]);

    const sameIp = await Attendance.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [refLongitude, refLatitude] },
          distanceField: 'distance',
          maxDistance: radiusInMeters,
          spherical: true,
          query: { session: sessionId, ipAddress: refIpAddress }
        }
      }
    ]);

    res.render('attendance_results', {
      withinDifferentIp,
      sameIp
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error',stack:error });
  }
  });


app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
