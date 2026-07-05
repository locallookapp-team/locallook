import React from 'react';
import { 
  // Food & Dining
  MdRestaurant, MdFastfood, MdLocalCafe, 
  MdSetMeal, MdRoomService, MdLocalDining, MdOutdoorGrill, MdStorefront,
  // Grocery & Retail
  MdLocalMall, MdShoppingCart, MdStore, MdAgriculture, 
  MdHardware, MdPets, MdLocalPharmacy, MdMenuBook, 
  MdCardGiftcard, MdChair, MdDevices, MdCheckroom, MdWatch, MdPropaneTank,
  // Beauty & Personal Care
  MdFaceRetouchingNatural, MdContentCut, MdSpa, MdBrush, MdShoppingBag,
  // Health & Medical
  MdLocalHospital, MdFitnessCenter, 
  // Automotive
  MdLocalGasStation, MdDirectionsCar, MdTwoWheeler, MdBuild, 
  MdTireRepair, MdLocalCarWash, MdSchool,
  // Travel & Accommodation
  MdHotel, MdBed, MdFlight, MdCarRental,
  // Home & Professional Services
  MdWaterDrop, MdLocalLaundryService, MdPrint, MdBuildCircle, MdAcUnit, 
  MdHomeRepairService, MdWindow, MdLocalShipping, MdDesktopWindows, MdCameraAlt, MdConstruction, MdEvent, MdComputer,
  // Financial & Business
  MdAccountBalance, MdPayments, MdCurrencyExchange, MdRequestQuote, MdShield, MdGavel, MdRealEstateAgent
} from 'react-icons/md';

// 🚀 NEW MIXED LIBRARY IMPORTS
import { GiGrain, GiPig, GiLargeDress } from 'react-icons/gi';
import { FaTshirt, FaEye } from 'react-icons/fa';
import { FaTooth, FaUmbrellaBeach } from 'react-icons/fa6';
import { IoIosBasket } from 'react-icons/io';
import { IoTvSharp } from 'react-icons/io5';
import { PiStethoscope } from 'react-icons/pi';
import { HiMiniBeaker } from 'react-icons/hi2';
import { LuCroissant } from 'react-icons/lu';

const CATEGORY_COLORS = {
  'Food & Dining': '#EF4444',             
  'Grocery & Retail': '#3B82F6',          
  'Health & Medical': '#10B981',          
  'Automotive': '#EA580C',                
  'Beauty & Personal Care': '#EC4899',    
  'Travel & Accommodation': '#8B5CF6',    
  'Home & Professional Services': '#92400E', 
  'Financial & Business': '#0F766E'       
};

const INDUSTRY_ICONS = {
  // Food & Dining
  'Restaurant': MdRestaurant,
  'Fast Food': MdFastfood,
  'Carinderia / Eatery': MdLocalDining,
  'Cafe / Coffee Shop': MdLocalCafe,
  'Bakery / Pastry Shop': LuCroissant, // Updated
  'Snack House / Grill': MdOutdoorGrill,
  'Food Cart / Street Food': MdStorefront, // Updated
  'Catering Service': MdRoomService,

  // Grocery & Retail
  'Supermarket': MdLocalMall,
  'Grocery Store': MdShoppingCart,
  'Convenience Store': MdStore,
  'Sari-Sari Store': MdStorefront,
  'Rice Dealer': GiGrain,
  'Meat Shop / Butcher': MdSetMeal,
  'Fresh Produce / Market Stall': IoIosBasket, // Updated
  'Hardware & Construction Supply': MdHardware,
  'Agri-Vet Supply': GiPig,
  'Pet Shop': MdPets,
  'Pharmacy / Drugstore': MdLocalPharmacy,
  'Bookstore / School Supply': MdMenuBook,
  'Gift & Flower Shop': MdCardGiftcard,
  'Furniture Store': MdChair,
  'Appliance Store': IoTvSharp, // Updated
  'Electronics & Gadgets': MdDevices,
  'Clothing / Apparel Boutique': FaTshirt,
  'Ukay-Ukay': MdCheckroom,
  'Jewelry & Watches': MdWatch,
  'LPG Dealer': MdPropaneTank,

  // Beauty & Personal Care
  'Beauty Salon': MdFaceRetouchingNatural,
  'Barbershop': MdContentCut,
  'Massage / Spa': MdSpa,
  'Skin Care Clinic': MdFaceRetouchingNatural,
  'Tattoo Studio': MdBrush,
  'Beauty Supply Store': MdShoppingBag,

  // Health & Medical
  'Hospital': MdLocalHospital,
  'Medical Clinic': PiStethoscope, // Updated
  'Dental Clinic': FaTooth, // Updated
  'Optical Clinic': FaEye, // Updated
  'Diagnostic Clinic / Lab': HiMiniBeaker, // Updated
  'Veterinary Clinic': MdPets,
  'Gym / Fitness Center': MdFitnessCenter,

  // Automotive
  'Gas Station': MdLocalGasStation,
  'Car Dealer': MdDirectionsCar,
  'Motorcycle Dealer': MdTwoWheeler,
  'Auto / Motorcycle Repair & Parts': MdBuild,
  'Vulcanizing / Tire Shop': MdTireRepair,
  'Car Wash / Detailing': MdLocalCarWash,
  'Driving School': MdSchool,

  // Travel & Accommodation
  'Hotel': MdHotel,
  'Resort': FaUmbrellaBeach, // Updated
  'Inn / Guesthouse': MdBed,
  'Travel Agency': MdFlight,
  'Vehicle Rental': MdCarRental,

  // Home & Professional Services
  'Water Refilling Station': MdWaterDrop,
  'Laundry Shop': MdLocalLaundryService,
  'Tailor / Dress Shop': GiLargeDress,
  'Printing / Copy Center': MdPrint,
  'Gadget Repair': MdBuildCircle,
  'Appliance / AC Repair': MdAcUnit,
  'Home Repair / Handyman': MdHomeRepairService,
  'Glass & Aluminum': MdWindow,
  'Courier & Freight Service': MdLocalShipping,
  'Internet Cafe': MdDesktopWindows,
  'Photography / Video Studio': MdCameraAlt,
  'Event Services & Rentals': MdEvent,
  'IT Services': MdComputer,

  // Financial & Business
  'Bank / ATM': MdAccountBalance,
  'Pawnshop / Remittance': MdPayments,
  'Money Changer': MdCurrencyExchange,
  'Lending / Cooperative': MdRequestQuote,
  'Insurance Agency': MdShield,
  'Law & Accounting Office': MdGavel,
  'Real Estate Office': MdRealEstateAgent
};

const CATEGORY_FALLBACK_ICONS = {
  'Food & Dining': MdRestaurant,
  'Grocery & Retail': MdShoppingCart,
  'Health & Medical': MdLocalHospital,
  'Automotive': MdDirectionsCar,
  'Beauty & Personal Care': MdFaceRetouchingNatural,
  'Travel & Accommodation': MdHotel,
  'Home & Professional Services': MdHomeRepairService,
  'Financial & Business': MdAccountBalance
};

export const CustomMapPin = ({ category, industry, size = 46 }) => {
  const pinColor = CATEGORY_COLORS[category] || '#1E293B';
  const Icon = INDUSTRY_ICONS[industry] || CATEGORY_FALLBACK_ICONS[category] || MdStorefront;

  return (
    <div style={{
      position: 'relative',
      width: `${size}px`,
      height: `${size * 1.15}px`, 
      display: 'flex',
      justifyContent: 'center',
      transform: 'translateY(-50%)',
      transition: 'transform 0.2s ease, filter 0.2s ease',
      cursor: 'pointer',
      filter: 'drop-shadow(0px 3px 5px rgba(0,0,0,0.2))'
    }}>
      
      <svg 
        viewBox="0 0 32 40" 
        style={{ 
          position: 'absolute', 
          width: '100%', 
          height: '100%',
          top: 0,
          left: 0
        }}
      >
        <path
          d="M16 0 C7.16 0 0 7.16 0 16 C0 24 12 36 15 39 C15.5 39.5 16.5 39.5 17 39 C20 36 32 24 32 16 C32 7.16 24.84 0 16 0 Z"
          fill="#FFFFFF"
        />
      </svg>

      <div style={{
        position: 'absolute',
        top: '6%', 
        width: `${size * 0.76}px`, 
        height: `${size * 0.76}px`,
        backgroundColor: pinColor,
        borderRadius: '50%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        color: '#FFFFFF'
      }}>
        <Icon size={size * 0.45} />
      </div>

    </div>
  );
};