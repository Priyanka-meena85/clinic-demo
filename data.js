/* CareWell Clinic demo content.
   TODO: Supabase — replace this file with tables (clinic_settings, doctors,
   services, faqs, testimonials) and load them in app.js. */

const CareWellData = {
  clinic: {
    name: "CareWell Clinic",
    shortName: "CareWell",
    city: "Camp, Pune",
    address: "214, MG Road, Camp, Pune 411001",
    phone: "9876543210",
    phoneDisplay: "+91 98765 43210",
    whatsapp: "9876543210",
    email: "care@carewellclinic.in",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=214+MG+Road+Camp+Pune",
    branches: [
      { city: "Pune", label: "Camp, Pune (Main)", address: "214, MG Road, Camp, Pune 411001" },
      { city: "Bhiwadi", label: "Bhiwadi Branch", address: "Sector 3, Alwar Bypass Road, Bhiwadi 301019" },
      { city: "Jaipur", label: "Jaipur Branch", address: "C-Scheme, Ashok Marg, Jaipur 302001" }
    ],
    closedWeekdays: [0],
    slots: [
      "09:00",
      "09:30",
      "10:00",
      "10:30",
      "11:00",
      "11:30",
      "12:00",
      "12:30",
      "16:00",
      "16:30",
      "17:00",
      "17:30",
      "18:00",
      "18:30"
    ],
    hours: [
      { days: "Monday to Saturday", time: "9:00 AM – 1:00 PM, 4:00 PM – 7:00 PM" },
      { days: "Sunday", time: "Closed" }
    ]
  },
  nav: [
    { href: "#services", label: "Services" },
    { href: "#doctors", label: "Doctors" },
    { href: "#queue", label: "Live Queue" },
    { href: "#visit", label: "Timings & Map" },
    { href: "#bookings", label: "Bookings", count: true }
  ],
  hero: {
    kicker: "Camp, Pune · OPD Monday to Saturday",
    title: "Sehat ka plan,",
    titleEmphasis: "bina waiting ke chakkar.",
    body: "General Consultation se Cardiology tak. Doctor choose karo, slot lock karo, aur seedha clinic aao. Reports ho to saath le aana.",
    primaryCta: "Appointment book karo",
    secondaryCta: "Doctors dekho",
    callCta: "Call clinic"
  },
  services: [
    {
      id: "general",
      title: "General Consultation",
      specialty: "General Physician",
      text: "Fever, cold, BP, sugar, aur roz ke health issues ke liye OPD.",
      icon: "stethoscope"
    },
    {
      id: "cardiology",
      title: "Cardiology",
      specialty: "Cardiologist",
      text: "Blood pressure, chest discomfort, aur heart check. Emergency ho to yahan wait mat karo.",
      icon: "heart-pulse"
    },
    {
      id: "dermatology",
      title: "Dermatology",
      specialty: "Dermatologist",
      text: "Skin allergy, acne, rashes. Photos kheench ke dikhana optional hai, doctor dekhega.",
      icon: "sun"
    },
    {
      id: "orthopedics",
      title: "Orthopedics",
      specialty: "Orthopedics",
      text: "Joint pain, sprain, back pain. X-ray pehle se hai to file saath lao.",
      icon: "bone"
    },
    {
      id: "gynecology",
      title: "Gynecology",
      specialty: "Gynecologist",
      text: "Periods, pregnancy consult, aur women's health. Private OPD room hai.",
      icon: "user"
    },
    {
      id: "pediatrics",
      title: "Pediatrics",
      specialty: "Pediatrician",
      text: "Bacchon ka fever, vaccines, aur growth check. Vaccination card laana.",
      icon: "baby"
    }
  ],
  doctors: [
    {
      id: "ananya-rao",
      name: "Dr. Ananya Rao",
      specialty: "General Physician",
      qualifications: "MBBS, MD (Internal Medicine)",
      experienceYears: 11,
      languages: ["Hindi", "English", "Marathi"],
      fee: 500,
      bio: "Fever, diabetes, blood pressure, aur routine OPD. Plan simple words mein batati hain."
    },
    {
      id: "vikram-shah",
      name: "Dr. Vikram Shah",
      specialty: "Cardiologist",
      qualifications: "MBBS, MD, DM (Cardiology)",
      experienceYears: 14,
      languages: ["Hindi", "English", "Gujarati"],
      fee: 900,
      bio: "BP follow-up, ECG review, aur heart-risk counselling. Emergency chest pain pe seedha ER jao."
    },
    {
      id: "meera-iyer",
      name: "Dr. Meera Iyer",
      specialty: "Dermatologist",
      qualifications: "MBBS, MD (Dermatology)",
      experienceYears: 9,
      languages: ["Hindi", "English", "Tamil"],
      fee: 700,
      bio: "Allergy, acne, aur chronic skin issues. Jo cream chal rahi hai, naam likh ke laana."
    },
    {
      id: "arjun-patel",
      name: "Dr. Arjun Patel",
      specialty: "Orthopedics",
      qualifications: "MBBS, MS (Orthopedics)",
      experienceYears: 12,
      languages: ["Hindi", "English", "Gujarati"],
      fee: 800,
      bio: "Knee pain, sports sprain, aur back pain. Purani X-ray ya MRI ho to file saath rakho."
    },
    {
      id: "neha-kulkarni",
      name: "Dr. Neha Kulkarni",
      specialty: "Gynecologist",
      qualifications: "MBBS, MS (Obstetrics & Gynecology)",
      experienceYears: 10,
      languages: ["Hindi", "English", "Marathi"],
      fee: 800,
      bio: "Antenatal visit, period problems, aur routine women's health check."
    },
    {
      id: "sameer-khan",
      name: "Dr. Sameer Khan",
      specialty: "Pediatrician",
      qualifications: "MBBS, MD (Pediatrics)",
      experienceYears: 8,
      languages: ["Hindi", "English", "Urdu"],
      fee: 600,
      bio: "Fever, vaccines, aur growth. Bacche ka weight aur vaccination card ready rakhna."
    }
  ],
  steps: [
    {
      icon: "stethoscope",
      title: "Doctor choose karo",
      text: "Specialty dekho aur jis doctor se milna hai, unka card select karo."
    },
    {
      icon: "calendar-check",
      title: "Din aur slot lo",
      text: "Subah ya shaam ka time choose karo. Booked slot dubara nahi milega."
    },
    {
      icon: "map-pin",
      title: "Clinic aao",
      text: "Token number leke MG Road wali clinic aa jaana. 10 minute pehle pahunchna."
    }
  ],
  testimonials: [
    {
      quote: "Dr. Rao ne BP ke numbers simple words mein samjhaye. Waiting bhi lamba nahi tha.",
      name: "Ritu S.",
      area: "Camp",
      visit: "General Consultation"
    },
    {
      quote: "Bacche ke fever ke liye same-day slot mil gaya. Staff ne calmly bata diya kya laana hai.",
      name: "Imran Q.",
      area: "Kondhwa",
      visit: "Pediatrics"
    },
    {
      quote: "Skin allergy ka consultation clear tha. Extra tests force nahi kiye, pehle history li.",
      name: "Pooja M.",
      area: "Kothrud",
      visit: "Dermatology"
    }
  ],
  faqs: [
    {
      q: "Appointment kaise book karun?",
      a: "Doctor choose karo, 10 digit mobile number daalo, date aur slot select karo. Token aur WhatsApp confirmation turant milta hai."
    },
    {
      q: "Fees kitni hai?",
      a: "Consultation fee doctor card pe likhi hai. Tests alag se hote hain. Payment clinic desk pe hota hai."
    },
    {
      q: "Reports laani padengi?",
      a: "Purani reports, medicine strip, aur vaccination card ho to saath le aao. Nahi hai to bhi OPD ho sakti hai."
    },
    {
      q: "Booking cancel kaise hogi?",
      a: "Bookings section mein apni booking dekho aur Cancel karo dabao. Slot wapas list mein aa jayega."
    },
    {
      q: "Sunday ko clinic khuli hai?",
      a: "Sunday band rehti hai. Monday se Saturday, subah 9 se 1 aur shaam 4 se 7."
    },
    {
      q: "Emergency mein kya karun?",
      a: "Chest pain, saans ki takleef, heavy bleeding, ya bacche ka serious illness ho to clinic ka slot wait mat karo. Nearest emergency service use karo."
    }
  ],
  messages: {
    name: "Naam likho, kam se kam 2 letters.",
    phone: "Phone number 10 digits ka hona chahiye.",
    doctor: "Doctor select karo.",
    date: "Date choose karo.",
    pastDate: "Past date pe booking nahi hogi.",
    closed: "Is din clinic band rehti hai. Koi aur din choose karo.",
    slot: "Ek time slot choose karo.",
    clash: "Is time pe aapki ek booking pehle se hai.",
    taken: "Yeh slot abhi book ho chuka hai. Doosra time lo.",
    saved: "Booking save ho gayi.",
    cancelled: "Booking cancel ho gayi.",
    enquiryName: "Naam likho.",
    enquiryPhone: "Phone number 10 digits ka hona chahiye.",
    enquiryMessage: "Message thoda detail mein likho.",
    enquirySaved: "Message save ho gaya. Clinic is number pe contact karegi.",
    emptyBookings: "Abhi koi active booking nahi hai. Upar se slot choose karo.",
    pickFirst: "Pehle doctor aur date choose karo.",
    dayOver: "Is din ke saare slots nikal chuke hain. Kal ka din try karo.",
    slotsOpen: "Aaj slot hai",
    slotsFull: "Aaj ke slots full hain",
    dayFinished: "Aaj ki OPD khatam",
    closedToday: "Aaj band hai",
    bookCta: "Slot book karo",
    cancelCta: "Cancel karo",
    filterAll: "All",
    age: "Age number mein likho.",
    problem: "Problem likho, taaki doctor pehle se jaane.",
    rescheduled: "Appointment reschedule ho gayi."
  }
};

const doctorExtras = {
  "ananya-rao": {
    group: "General",
    location: "Pune",
    timing: "Mon–Sat, 9:00 AM – 1:00 PM",
    rating: 4.8,
    reviewCount: 126,
    reviews: [
      { name: "Ritu S.", text: "BP follow-up clear tha. Next slot bhi bata diya." },
      { name: "Aman K.", text: "Fever ka plan simple words mein samjhaya." }
    ]
  },
  "vikram-shah": {
    group: "Cardiology",
    location: "Pune",
    timing: "Mon–Sat, 4:00 PM – 7:00 PM",
    rating: 4.9,
    reviewCount: 98,
    reviews: [
      { name: "Pooja M.", text: "ECG report line by line dekhi. Extra test force nahi kiya." }
    ]
  },
  "meera-iyer": {
    group: "Skin",
    location: "Pune",
    timing: "Tue–Sat, 11:00 AM – 2:00 PM",
    rating: 4.7,
    reviewCount: 141,
    reviews: [
      { name: "Neha V.", text: "Allergy ka reason samajh aa gaya. Cream ka naam likh diya." }
    ]
  },
  "arjun-patel": {
    group: "Ortho",
    location: "Bhiwadi",
    timing: "Mon–Fri, 10:00 AM – 1:00 PM",
    rating: 4.6,
    reviewCount: 77,
    reviews: [
      { name: "Rohit D.", text: "Knee pain ke liye Bhiwadi branch pe same-week slot mila." }
    ]
  },
  "neha-kulkarni": {
    group: "Gynecology",
    location: "Jaipur",
    timing: "Mon–Sat, 9:30 AM – 1:00 PM",
    rating: 4.8,
    reviewCount: 110,
    reviews: [
      { name: "Kavita J.", text: "Jaipur OPD mein wait kam tha. Private room tha." }
    ]
  },
  "sameer-khan": {
    group: "Pediatrics",
    location: "Jaipur",
    timing: "Mon–Sat, 4:00 PM – 7:00 PM",
    rating: 4.9,
    reviewCount: 156,
    reviews: [
      { name: "Imran Q.", text: "Bacche ka fever same day dekh liya. Vaccine card note ho gaya." }
    ]
  }
};

CareWellData.doctors.forEach((doctor) => Object.assign(doctor, doctorExtras[doctor.id]));

CareWellData.doctors.push(
  {
    id: "kabir-jain",
    name: "Dr. Kabir Jain",
    specialty: "Dentist",
    group: "Dental",
    location: "Bhiwadi",
    timing: "Mon–Sat, 10:00 AM – 2:00 PM",
    qualifications: "BDS, MDS (Conservative Dentistry)",
    experienceYears: 7,
    languages: ["Hindi", "English"],
    fee: 350,
    rating: 4.5,
    reviewCount: 84,
    bio: "Tooth pain, filling, aur scaling. X-ray clinic mein ho sakta hai.",
    reviews: [{ name: "Sana A.", text: "Pain ka slot jaldi mil gaya. Bill fee card jitni thi." }]
  },
  {
    id: "leela-nair",
    name: "Dr. Leela Nair",
    specialty: "ENT",
    group: "ENT",
    location: "Jaipur",
    timing: "Mon–Fri, 9:00 AM – 12:30 PM",
    qualifications: "MBBS, MS (ENT)",
    experienceYears: 13,
    languages: ["Hindi", "English", "Malayalam"],
    fee: 650,
    rating: 4.7,
    reviewCount: 91,
    bio: "Ear pain, sinus, aur throat infection. Hearing complaint ho to purani report lao.",
    reviews: [{ name: "Manish G.", text: "Sinus ka plan clear tha. Surgery ki baat force nahi ki." }]
  }
);

CareWellData.services.push(
  {
    id: "dental",
    title: "Dental",
    specialty: "Dentist",
    text: "Tooth pain, filling, aur scaling. Bhiwadi branch pe Dr. Jain.",
    icon: "smile"
  },
  {
    id: "ent",
    title: "ENT",
    specialty: "ENT",
    text: "Ear, nose, throat. Jaipur branch pe Dr. Nair.",
    icon: "ear"
  }
);

CareWellData.clinic.slotCapacity = 4;
CareWellData.clinic.slotLoad = {
  "ananya-rao": { "11:30": 2, "12:00": 4 },
  "vikram-shah": { "10:00": 3 },
  "kabir-jain": { "09:30": 2 }
};
CareWellData.clinic.nearLocation = "Pune";

CareWellData.records = {
  family: [
    { id: "riya", name: "Riya Sharma", patientId: "CW-2048", age: 28, relation: "Self", phone: "9811111111" },
    { id: "papa", name: "Suresh Sharma", patientId: "CW-1980", age: 58, relation: "Papa", phone: "9811111111" },
    { id: "mummy", name: "Lata Sharma", patientId: "CW-1988", age: 54, relation: "Mummy", phone: "9811111111" },
    { id: "baccha", name: "Aarav Sharma", patientId: "CW-2210", age: 6, relation: "Baccha", phone: "9811111111" }
  ],
  prescriptions: [
    { id: "rx-1", patientId: "CW-2048", date: "2026-11-12", doctor: "Dr. Ananya Rao", text: "Paracetamol 500 mg, 1 tablet after food, 3 days. ORS. Review if fever stays." },
    { id: "rx-2", patientId: "CW-1980", date: "2026-05-20", doctor: "Dr. Vikram Shah", text: "Continue BP medicine. Low salt. Repeat BP checkup in 6 months." }
  ],
  reports: [
    { id: "rep-1", patientId: "CW-2048", date: "2026-11-10", type: "X-Ray", name: "Chest X-Ray", note: "No acute finding. Physician correlation." },
    { id: "rep-2", patientId: "CW-1980", date: "2026-11-02", type: "Blood Test", name: "Sugar Report", note: "Fasting 118 mg/dL. Follow-up with physician." },
    { id: "rep-3", patientId: "CW-2210", date: "2026-10-18", type: "Blood Test", name: "CBC", note: "Hemoglobin 11.8 g/dL." }
  ],
  visits: [
    { patientId: "CW-2048", date: "2026-11-12", label: "Fever" },
    { patientId: "CW-2048", date: "2026-11-10", label: "X-Ray" },
    { patientId: "CW-2048", date: "2026-11-05", label: "Checkup" },
    { patientId: "CW-1980", date: "2026-05-20", label: "BP checkup" },
    { patientId: "CW-2210", date: "2026-10-18", label: "Vaccine" }
  ],
  followups: [
    { id: "fu-1", patient: "Suresh Sharma", phone: "9811111111", reason: "BP checkup ka 6 mahine ho gaye", due: "Is hafte" },
    { id: "fu-2", patient: "Aarav Sharma", phone: "9811111111", reason: "Vaccination reminder", due: "Next month" },
    { id: "fu-3", patient: "Lata Sharma", phone: "9811111111", reason: "Diabetes follow-up", due: "15 din" }
  ],
  queue: { doctorId: "ananya-rao", current: 8, yourToken: 12, minutes: 30 },
  calls: [
    { id: "call-1", name: "Ritu Sharma", phone: "9845011122", reason: "Call miss ho gaya, booking confirm karni thi", status: "Missed" },
    { id: "call-2", name: "Imran Qureshi", phone: "9765432109", reason: "Slot change pooch rahe the", status: "Missed" }
  ]
};
