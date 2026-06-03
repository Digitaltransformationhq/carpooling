export interface Ride {
  id: string;
  driverId?: string;
  driver: {
    name: string;
    avatar: string;
    rating: number;
    reviewCount: number;
  };
  from: string;
  to: string;
  date: string;
  time: string;
  price: number;
  seats: number;
  distance: string;
  duration: string;
  carModel: string;
  preferences: string[];
  completed?: boolean;
  bookedSeats?: number;
}

export const mockRides: Ride[] = [
  {
    id: "1",
    driver: {
      name: "Priya Sharma",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
      rating: 4.9,
      reviewCount: 127,
    },
    from: "New Delhi, DL",
    to: "Jaipur, RJ",
    date: "2026-06-05",
    time: "09:00 AM",
    price: 650,
    seats: 2,
    distance: "280 km",
    duration: "5h 00m",
    carModel: "Hyundai Creta",
    preferences: ["No Smoking", "Music OK", "Pets OK"],
  },
  {
    id: "2",
    driver: {
      name: "Arjun Mehta",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
      rating: 4.8,
      reviewCount: 89,
    },
    from: "Mumbai, MH",
    to: "Pune, MH",
    date: "2026-06-06",
    time: "07:00 AM",
    price: 400,
    seats: 3,
    distance: "150 km",
    duration: "3h 15m",
    carModel: "Maruti Suzuki Swift",
    preferences: ["No Smoking", "Quiet Ride"],
  },
  {
    id: "3",
    driver: {
      name: "Ananya Iyer",
      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop",
      rating: 5.0,
      reviewCount: 156,
    },
    from: "Bengaluru, KA",
    to: "Mysuru, KA",
    date: "2026-06-04",
    time: "02:00 PM",
    price: 350,
    seats: 1,
    distance: "145 km",
    duration: "3h 00m",
    carModel: "Tata Nexon",
    preferences: ["No Smoking", "Music OK", "Chatty"],
  },
  {
    id: "4",
    driver: {
      name: "Rohan Gupta",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop",
      rating: 4.7,
      reviewCount: 74,
    },
    from: "Hyderabad, TS",
    to: "Bengaluru, KA",
    date: "2026-06-07",
    time: "06:00 AM",
    price: 1200,
    seats: 2,
    distance: "575 km",
    duration: "9h 00m",
    carModel: "Toyota Innova Crysta",
    preferences: ["No Smoking", "Pets OK"],
  },
  {
    id: "5",
    driver: {
      name: "Sneha Patel",
      avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop",
      rating: 4.9,
      reviewCount: 203,
    },
    from: "Ahmedabad, GJ",
    to: "Surat, GJ",
    date: "2026-06-08",
    time: "08:30 AM",
    price: 600,
    seats: 3,
    distance: "265 km",
    duration: "4h 30m",
    carModel: "Honda City",
    preferences: ["No Smoking", "Music OK"],
  },
  {
    id: "6",
    driver: {
      name: "Vikram Nair",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop",
      rating: 4.6,
      reviewCount: 52,
    },
    from: "Chennai, TN",
    to: "Bengaluru, KA",
    date: "2026-06-09",
    time: "06:00 PM",
    price: 750,
    seats: 2,
    distance: "350 km",
    duration: "6h 00m",
    carModel: "Mahindra XUV700",
    preferences: ["No Smoking", "Quiet Ride"],
  },
];
