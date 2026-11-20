import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'studiospace.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    passwordHash TEXT NOT NULL,
    photoUrl TEXT NOT NULL DEFAULT '',
    provider TEXT NOT NULL DEFAULT 'credentials',
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS studios (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    hourlyRate REAL NOT NULL,
    securityDeposit REAL NOT NULL,
    maxCapacity INTEGER NOT NULL,
    location TEXT NOT NULL,
    imageUrl TEXT NOT NULL,
    gallery TEXT NOT NULL DEFAULT '[]',
    amenities TEXT NOT NULL DEFAULT '[]',
    overview TEXT NOT NULL,
    rating REAL NOT NULL DEFAULT 5.0,
    reviewCount INTEGER NOT NULL DEFAULT 0,
    sqft INTEGER NOT NULL DEFAULT 1200,
    ceilingHeight TEXT NOT NULL DEFAULT '14 ft',
    ownerEmail TEXT NOT NULL,
    ownerName TEXT NOT NULL,
    ownerPhoto TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    studioId TEXT NOT NULL,
    studioTitle TEXT NOT NULL,
    studioImage TEXT NOT NULL,
    studioLocation TEXT NOT NULL,
    studioCategory TEXT NOT NULL,
    hostEmail TEXT NOT NULL,
    hostName TEXT NOT NULL,
    userEmail TEXT NOT NULL,
    userName TEXT NOT NULL,
    bookingDate TEXT NOT NULL,
    startHour INTEGER NOT NULL,
    endHour INTEGER NOT NULL,
    durationHours INTEGER NOT NULL,
    hourlyRate REAL NOT NULL,
    securityDeposit REAL NOT NULL,
    totalAmount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    notes TEXT NOT NULL DEFAULT '',
    invoiceNumber TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (studioId) REFERENCES studios(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS wishlists (
    id TEXT PRIMARY KEY,
    userEmail TEXT NOT NULL,
    studioId TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    UNIQUE(userEmail, studioId),
    FOREIGN KEY (studioId) REFERENCES studios(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    studioId TEXT NOT NULL,
    userEmail TEXT NOT NULL,
    userName TEXT NOT NULL,
    userPhoto TEXT NOT NULL DEFAULT '',
    rating INTEGER NOT NULL,
    comment TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (studioId) REFERENCES studios(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    createdAt TEXT NOT NULL
  );
`);

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  photoUrl: string;
  provider: string;
  createdAt: string;
}

export interface StudioRow {
  id: string;
  title: string;
  category: string;
  hourlyRate: number;
  securityDeposit: number;
  maxCapacity: number;
  location: string;
  imageUrl: string;
  gallery: string;
  amenities: string;
  overview: string;
  rating: number;
  reviewCount: number;
  sqft: number;
  ceilingHeight: string;
  ownerEmail: string;
  ownerName: string;
  ownerPhoto: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudioDTO extends Omit<StudioRow, 'gallery' | 'amenities'> {
  gallery: string[];
  amenities: string[];
}

export function serializeStudio(row: StudioRow): StudioDTO {
  let gallery: string[] = [];
  let amenities: string[] = [];
  try {
    gallery = JSON.parse(row.gallery);
  } catch {
    gallery = [];
  }
  try {
    amenities = JSON.parse(row.amenities);
  } catch {
    amenities = [];
  }
  return {
    ...row,
    gallery: Array.isArray(gallery) && gallery.length > 0 ? gallery : [row.imageUrl],
    amenities: Array.isArray(amenities) ? amenities : [],
  };
}

function getFutureDate(daysAhead: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().split('T')[0];
}

function seedDatabase() {
  const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
  const studioCount = (db.prepare('SELECT COUNT(*) as count FROM studios').get() as { count: number }).count;

  if (userCount > 0 && studioCount > 0) {
    return;
  }

  const now = new Date().toISOString();
  const defaultHash = bcrypt.hashSync('Studio123!', 10);

  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (id, name, email, passwordHash, photoUrl, provider, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run(
    'usr_alex_mercer',
    'Alex Mercer',
    'alex@studiospace.io',
    defaultHash,
    '',
    'credentials',
    now
  );
  insertUser.run(
    'usr_maya_lin',
    'Maya Lin',
    'maya@studiospace.io',
    defaultHash,
    '',
    'credentials',
    now
  );
  insertUser.run(
    'usr_devon_brooks',
    'Devon Brooks',
    'devon@studiospace.io',
    defaultHash,
    '',
    'credentials',
    now
  );

  const IMG_LOFT = '/src/assets/images/hero_daylight_loft_1795069737562.jpg';
  const IMG_CINEMA = '/src/assets/images/studio_cinema_stage_1795069833041.jpg';
  const IMG_CYC = '/src/assets/images/studio_photo_cyc_1795069832715.jpg';
  const IMG_PODCAST = '/src/assets/images/studio_podcast_lounge_1795069833511.jpg';
  const IMG_MUSIC = '/src/assets/images/studio_music_suite_1795069835817.jpg';
  const IMG_ART = '/src/assets/images/studio_art_workshop_1795070044560.jpg';

  const seededStudios = [
    {
      id: 'std_mercer_daylight_loft',
      title: 'Mercer Street Daylight Loft',
      category: 'Photo Studio',
      hourlyRate: 165,
      securityDeposit: 250,
      maxCapacity: 24,
      location: 'SoHo, New York',
      imageUrl: IMG_LOFT,
      gallery: [IMG_LOFT, IMG_CYC, IMG_ART],
      amenities: [
        'North & West Factory Windows',
        'Profoto Pro-11 Strobes',
        'C-Stands & Sandbags',
        'Freight Elevator',
        'Hair & Makeup Station',
        '1Gbps Fiber Wi-Fi',
        'Espresso Bar & Kitchenette',
        'Blackout Drapes',
      ],
      overview:
        'A 3,400 sq ft cast-iron corner loft bathed in wraparound natural daylight from 14-foot steel casement windows. Engineered for editorial fashion campaigns, furniture lookbooks, and architectural interviews, the space includes modular mid-century staging pieces, a rolling grip cart, silk diffusion frames, and a private mezzanine styling suite with direct freight access.',
      rating: 4.96,
      reviewCount: 3,
      sqft: 3400,
      ceilingHeight: '15 ft',
      ownerEmail: 'maya@studiospace.io',
      ownerName: 'Maya Lin',
      ownerPhoto: '',
      createdAt: '2026-10-02T10:00:00.000Z',
      updatedAt: '2026-10-02T10:00:00.000Z',
    },
    {
      id: 'std_blackbox_stage_a',
      title: 'Stage Four Acoustic Sound Stage',
      category: 'Film Stage',
      hourlyRate: 240,
      securityDeposit: 450,
      maxCapacity: 40,
      location: 'Arts District, Los Angeles',
      imageUrl: IMG_CINEMA,
      gallery: [IMG_CINEMA, IMG_LOFT, IMG_CYC],
      amenities: [
        'Pre-Lit Overhead Grid',
        '200-Amp 3-Phase Camlock Power',
        'Acoustic Soundproofing (NC-20)',
        'Drive-In Roll-Up Bay',
        'Dolly Track Included',
        'Green Room & Client Monitor',
        'Dedicated Loading Dock',
        'Climate Controlled HVAC',
      ],
      overview:
        'Purpose-built independent cinema sound stage rated to NC-20 acoustic isolation for clean dialogue capture. Features a motorized aluminum lighting truss rigged with bi-color LED soft panels and tungsten Fresnels, 200-amp three-phase distribution, matte charcoal sound blankets, and direct ground-level roll-in access for grip trucks and set builds.',
      rating: 4.94,
      reviewCount: 2,
      sqft: 4800,
      ceilingHeight: '22 ft',
      ownerEmail: 'maya@studiospace.io',
      ownerName: 'Maya Lin',
      ownerPhoto: '',
      createdAt: '2026-10-05T14:30:00.000Z',
      updatedAt: '2026-10-05T14:30:00.000Z',
    },
    {
      id: 'std_crosby_cyc_studio',
      title: 'Crosby White Cyclorama Studio',
      category: 'Photo Studio',
      hourlyRate: 135,
      securityDeposit: 200,
      maxCapacity: 18,
      location: 'Williamsburg, Brooklyn',
      imageUrl: IMG_CYC,
      gallery: [IMG_CYC, IMG_LOFT],
      amenities: [
        '28ft Seamless Corner Cyc Wall',
        'Profoto D2 Lighting Kit',
        'Tethering Cart & 27" Monitor',
        'Garment Steamer & Rolling Racks',
        'Seamless Paper Backdrop Wall',
        '1Gbps Fiber Wi-Fi',
        'Private Restroom & Shower',
      ],
      overview:
        'Freshly painted 28-foot two-wall infinity cyclorama paired with unobstructed northern skylight exposure. Built by commercial still-life and e-commerce photographers, every booking includes a color-calibrated tethering workstation, heavy-duty chrome C-stands, V-flats, and instant repaint turnaround between multi-day shoots.',
      rating: 4.92,
      reviewCount: 2,
      sqft: 2200,
      ceilingHeight: '14 ft',
      ownerEmail: 'alex@studiospace.io',
      ownerName: 'Alex Mercer',
      ownerPhoto: '',
      createdAt: '2026-10-08T09:15:00.000Z',
      updatedAt: '2026-10-08T09:15:00.000Z',
    },
    {
      id: 'std_timber_podcast_lounge',
      title: 'Oak & Brass Broadcast Lounge',
      category: 'Podcast Lounge',
      hourlyRate: 95,
      securityDeposit: 100,
      maxCapacity: 8,
      location: 'West Loop, Chicago',
      imageUrl: IMG_PODCAST,
      gallery: [IMG_PODCAST, IMG_MUSIC],
      amenities: [
        '4x Shure SM7B Microphones',
        'Rodecaster Pro II Console',
        '3x Sony FX30 4K Camera Rig',
        'Acoustic Oak Slat Treatment',
        'Live Switching & ISO Recording',
        'Bi-Color Soft Key Lighting',
        'Complimentary Cold Brew & Tea',
      ],
      overview:
        'Turnkey audio and multi-camera video podcast room wrapped in custom architectural oak slat diffusers and overhead acoustic clouds. Walk in with an SD card or SSD and walk out with broadcast-ready 4K multi-angle footage and pristine 48kHz WAV stems from four calibrated Shure SM7B stations.',
      rating: 4.98,
      reviewCount: 2,
      sqft: 680,
      ceilingHeight: '11 ft',
      ownerEmail: 'alex@studiospace.io',
      ownerName: 'Alex Mercer',
      ownerPhoto: '',
      createdAt: '2026-10-12T11:20:00.000Z',
      updatedAt: '2026-10-12T11:20:00.000Z',
    },
    {
      id: 'std_analog_tracking_suite',
      title: 'Birchwood Analog Control & Live Suite',
      category: 'Music Suite',
      hourlyRate: 180,
      securityDeposit: 300,
      maxCapacity: 12,
      location: 'East Nashville, Tennessee',
      imageUrl: IMG_MUSIC,
      gallery: [IMG_MUSIC, IMG_PODCAST],
      amenities: [
        '48-Channel Analog Mixing Console',
        'Yamaha C7 Grand Piano',
        'Floating Isolated Live Room',
        'Vintage Neve & API Preamps',
        'Genelec & NS-10 Monitoring',
        'Iso Vocal Booth',
        'House Ludwig Drum Kit',
      ],
      overview:
        'Acoustically tuned tracking and mixing room featuring custom birch skyline diffusers, a meticulously maintained 48-channel analog console, and direct sightlines into a bright 900 sq ft live room stocked with a tuned grand piano and vintage percussion. Available with dry room rental or optional assistant engineer.',
      rating: 4.95,
      reviewCount: 2,
      sqft: 1850,
      ceilingHeight: '13 ft',
      ownerEmail: 'maya@studiospace.io',
      ownerName: 'Maya Lin',
      ownerPhoto: '',
      createdAt: '2026-10-16T16:40:00.000Z',
      updatedAt: '2026-10-16T16:40:00.000Z',
    },
    {
      id: 'std_northlight_art_atelier',
      title: 'Northlight Ceramics & Painting Atelier',
      category: 'Art Workshop',
      hourlyRate: 85,
      securityDeposit: 120,
      maxCapacity: 16,
      location: 'Mission District, San Francisco',
      imageUrl: IMG_ART,
      gallery: [IMG_ART, IMG_LOFT],
      amenities: [
        'North-Facing Sawtooth Skylights',
        'Solid Oak Worktables',
        'Two Pottery Wheels & Utility Sink',
        'Heavy-Duty Easels & Drying Racks',
        'Natural Limewash Plaster Walls',
        'Dedicated Tool Wall',
        'Ground-Floor Double Doors',
      ],
      overview:
        'A serene, skylight-drenched creative workshop crafted for fine art fabrication, ceramic workshops, editorial set styling, and small-group masterclasses. Limewash plaster walls and raw timber beams create an inspiring backdrop for process documentaries as well as hands-on production.',
      rating: 4.89,
      reviewCount: 2,
      sqft: 1950,
      ceilingHeight: '16 ft',
      ownerEmail: 'maya@studiospace.io',
      ownerName: 'Maya Lin',
      ownerPhoto: '',
      createdAt: '2026-10-20T08:45:00.000Z',
      updatedAt: '2026-10-20T08:45:00.000Z',
    },
    {
      id: 'std_harbor_film_stage_b',
      title: 'Red Hook Commercial Production Stage',
      category: 'Film Stage',
      hourlyRate: 210,
      securityDeposit: 350,
      maxCapacity: 32,
      location: 'Red Hook, Brooklyn',
      imageUrl: IMG_CINEMA,
      gallery: [IMG_CINEMA, IMG_CYC],
      amenities: [
        'Silent HVAC System',
        '100-Amp House Power',
        'Full Grip & Electric Package',
        'Client Video Village Lounge',
        'Private Parking (4 Vans)',
        'Kitchenette & Craft Services Area',
      ],
      overview:
        'Waterfront commercial production stage designed for tabletop food shoots, music videos, and branded documentaries. Offers silent climate control for sync sound, private van parking directly outside the load-in ramp, and an elevated client video village overlooking the floor.',
      rating: 4.86,
      reviewCount: 1,
      sqft: 3600,
      ceilingHeight: '18 ft',
      ownerEmail: 'maya@studiospace.io',
      ownerName: 'Maya Lin',
      ownerPhoto: '',
      createdAt: '2026-10-24T13:10:00.000Z',
      updatedAt: '2026-10-24T13:10:00.000Z',
    },
    {
      id: 'std_silverlake_vocal_suite',
      title: 'Silver Lake Mastering & Vocal Suite',
      category: 'Music Suite',
      hourlyRate: 120,
      securityDeposit: 150,
      maxCapacity: 6,
      location: 'Silver Lake, Los Angeles',
      imageUrl: IMG_MUSIC,
      gallery: [IMG_MUSIC, IMG_PODCAST],
      amenities: [
        'Neumann U87 Ai & Sony C-800G',
        'Pro Tools HDX & Ableton Live',
        'Acoustic Cloud & Bass Traps',
        'Outboard Tube Compression',
        'Private Patio Courtyard',
        '1Gbps Fiber Wi-Fi',
      ],
      overview:
        'Intimate songwriting, vocal tracking, and Dolby-ready mixing room tucked behind a private courtyard in Silver Lake. Calibrated nearfield and midfield monitoring deliver effortless translation for label sessions, film score overdubs, and voiceover production.',
      rating: 4.91,
      reviewCount: 1,
      sqft: 920,
      ceilingHeight: '10 ft',
      ownerEmail: 'maya@studiospace.io',
      ownerName: 'Maya Lin',
      ownerPhoto: '',
      createdAt: '2026-10-28T15:00:00.000Z',
      updatedAt: '2026-10-28T15:00:00.000Z',
    },
  ];

  const insertStudio = db.prepare(`
    INSERT INTO studios (
      id, title, category, hourlyRate, securityDeposit, maxCapacity, location,
      imageUrl, gallery, amenities, overview, rating, reviewCount, sqft,
      ceilingHeight, ownerEmail, ownerName, ownerPhoto, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const s of seededStudios) {
    insertStudio.run(
      s.id,
      s.title,
      s.category,
      s.hourlyRate,
      s.securityDeposit,
      s.maxCapacity,
      s.location,
      s.imageUrl,
      JSON.stringify(s.gallery),
      JSON.stringify(s.amenities),
      s.overview,
      s.rating,
      s.reviewCount,
      s.sqft,
      s.ceilingHeight,
      s.ownerEmail,
      s.ownerName,
      s.ownerPhoto,
      s.createdAt,
      s.updatedAt
    );
  }

  const insertReview = db.prepare(`
    INSERT INTO reviews (id, studioId, userEmail, userName, userPhoto, rating, comment, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seededReviews = [
    {
      id: 'rev_1',
      studioId: 'std_mercer_daylight_loft',
      userEmail: 'devon@studiospace.io',
      userName: 'Devon Brooks',
      rating: 5,
      comment:
        'The afternoon light through the west windows saved us two hours of lighting setup. Freight load-in was smooth and the grip cart had every sandbag and clamp we needed.',
      createdAt: '2026-10-29T18:00:00.000Z',
    },
    {
      id: 'rev_2',
      studioId: 'std_mercer_daylight_loft',
      userEmail: 'alex@studiospace.io',
      userName: 'Alex Mercer',
      rating: 5,
      comment:
        'Shot a full 18-look knitwear campaign here with a crew of twelve. Plenty of power circuits, quiet acoustics for behind-the-scenes interviews, and responsive host communication.',
      createdAt: '2026-11-04T12:20:00.000Z',
    },
    {
      id: 'rev_3',
      studioId: 'std_mercer_daylight_loft',
      userEmail: 'maya@studiospace.io',
      userName: 'Elena Rostova',
      rating: 5,
      comment:
        'Immaculate floors, accurate dimensions, and zero hidden fees. Easily our go-to daylight loft in lower Manhattan.',
      createdAt: '2026-11-08T16:10:00.000Z',
    },
    {
      id: 'rev_4',
      studioId: 'std_blackbox_stage_a',
      userEmail: 'devon@studiospace.io',
      userName: 'Devon Brooks',
      rating: 5,
      comment:
        'True sound isolation—recorded clean lav and boom dialogue during rush hour with zero exterior bleed. Pre-rigged overhead softboxes cut our pre-light time in half.',
      createdAt: '2026-11-01T20:15:00.000Z',
    },
    {
      id: 'rev_5',
      studioId: 'std_blackbox_stage_a',
      userEmail: 'alex@studiospace.io',
      userName: 'Alex Mercer',
      rating: 5,
      comment:
        'Drive-in bay made loading our 12-foot set wall effortless. Host confirmed our schedule quickly and provided clear breaker maps before call time.',
      createdAt: '2026-11-07T09:45:00.000Z',
    },
    {
      id: 'rev_6',
      studioId: 'std_crosby_cyc_studio',
      userEmail: 'devon@studiospace.io',
      userName: 'Devon Brooks',
      rating: 5,
      comment:
        'Crisp freshly rolled cyc curve with zero scuffs. Tethering station was calibrated and ready the moment our digi-tech arrived.',
      createdAt: '2026-11-02T14:00:00.000Z',
    },
    {
      id: 'rev_7',
      studioId: 'std_crosby_cyc_studio',
      userEmail: 'maya@studiospace.io',
      userName: 'Maya Lin',
      rating: 5,
      comment:
        'Consistent northern daylight plus reliable Profoto packs. Ideal layout for fast-paced catalog days.',
      createdAt: '2026-11-09T11:30:00.000Z',
    },
    {
      id: 'rev_8',
      studioId: 'std_timber_podcast_lounge',
      userEmail: 'devon@studiospace.io',
      userName: 'Devon Brooks',
      rating: 5,
      comment:
        'Recorded three founder episodes back-to-back. The oak slat wall looks crisp on 4K camera and the audio needed almost no EQ in post.',
      createdAt: '2026-11-06T17:40:00.000Z',
    },
    {
      id: 'rev_9',
      studioId: 'std_analog_tracking_suite',
      userEmail: 'alex@studiospace.io',
      userName: 'Alex Mercer',
      rating: 5,
      comment:
        'Tracked strings and grand piano for a documentary score. The live room has warm, controlled decay and every patchbay channel was spotless.',
      createdAt: '2026-11-05T19:00:00.000Z',
    },
    {
      id: 'rev_10',
      studioId: 'std_northlight_art_atelier',
      userEmail: 'devon@studiospace.io',
      userName: 'Devon Brooks',
      rating: 5,
      comment:
        'Hosted a twelve-person ceramic hand-building workshop and captured a short brand film simultaneously. Beautiful soft skylight all afternoon.',
      createdAt: '2026-11-10T15:25:00.000Z',
    },
  ];

  for (const r of seededReviews) {
    insertReview.run(r.id, r.studioId, r.userEmail, r.userName, '', r.rating, r.comment, r.createdAt);
  }

  const dateSoon1 = getFutureDate(2);
  const dateSoon2 = getFutureDate(4);
  const dateSoon3 = getFutureDate(3);

  const insertBooking = db.prepare(`
    INSERT INTO bookings (
      id, studioId, studioTitle, studioImage, studioLocation, studioCategory,
      hostEmail, hostName, userEmail, userName, bookingDate, startHour, endHour,
      durationHours, hourlyRate, securityDeposit, totalAmount, status, notes,
      invoiceNumber, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Confirmed booking for examiner Alex Mercer (enables immediate PDF Invoice download & double-booking test on Mercer Street Daylight Loft 10:00-14:00)
  insertBooking.run(
    'bkg_confirmed_demo_1',
    'std_mercer_daylight_loft',
    'Mercer Street Daylight Loft',
    IMG_LOFT,
    'SoHo, New York',
    'Photo Studio',
    'maya@studiospace.io',
    'Maya Lin',
    'alex@studiospace.io',
    'Alex Mercer',
    dateSoon1,
    10,
    14,
    4,
    165,
    250,
    165 * 4 + 250,
    'Confirmed',
    'Autumn editorial lookbook shoot, 8 crew members, freight elevator requested at 9:45 AM.',
    'INV-SS-2026-0104',
    now
  );

  // Pending booking for examiner Alex Mercer (enables immediate Cancel Booking test)
  insertBooking.run(
    'bkg_pending_demo_2',
    'std_blackbox_stage_a',
    'Stage Four Acoustic Sound Stage',
    IMG_CINEMA,
    'Arts District, Los Angeles',
    'Film Stage',
    'maya@studiospace.io',
    'Maya Lin',
    'alex@studiospace.io',
    'Alex Mercer',
    dateSoon2,
    13,
    17,
    4,
    240,
    450,
    240 * 4 + 450,
    'Pending',
    'Commercial interview lighting test with cinema camera package and dolly track.',
    'INV-SS-2026-0109',
    now
  );

  // Incoming pending booking on Alex's own studio (so Alex can test Host Confirm / Cancel)
  insertBooking.run(
    'bkg_host_incoming_3',
    'std_crosby_cyc_studio',
    'Crosby White Cyclorama Studio',
    IMG_CYC,
    'Williamsburg, Brooklyn',
    'Photo Studio',
    'alex@studiospace.io',
    'Alex Mercer',
    'devon@studiospace.io',
    'Devon Brooks',
    dateSoon3,
    9,
    12,
    3,
    135,
    200,
    135 * 3 + 200,
    'Pending',
    'Product packaging still-life session using the Profoto D2 strobes and tethering cart.',
    'INV-SS-2026-0112',
    now
  );

  db.prepare(`
    INSERT OR IGNORE INTO wishlists (id, userEmail, studioId, createdAt)
    VALUES (?, ?, ?, ?)
  `).run(crypto.randomUUID(), 'alex@studiospace.io', 'std_analog_tracking_suite', now);
}

seedDatabase();

export default db;
