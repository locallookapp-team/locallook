import React from 'react';
import { 
  MdRestaurant, MdFastfood, MdLocalCafe, 
  MdSetMeal, MdRoomService, MdLocalDining, MdOutdoorGrill, MdStorefront,
  MdLocalMall, MdShoppingCart, MdStore, 
  MdHardware, MdPets, MdLocalPharmacy, MdMenuBook, 
  MdCardGiftcard, MdChair, MdDevices, MdCheckroom, MdWatch, MdPropaneTank,
  MdFaceRetouchingNatural, MdContentCut, MdSpa, MdBrush, MdShoppingBag,
  MdLocalHospital, MdFitnessCenter, 
  MdLocalGasStation, MdDirectionsCar, MdTwoWheeler, MdBuild, 
  MdTireRepair, MdLocalCarWash, MdSchool,
  MdHotel, MdBed, MdFlight, MdCarRental,
  MdWaterDrop, MdLocalLaundryService, MdPrint, MdBuildCircle, MdAcUnit, 
  MdHomeRepairService, MdWindow, MdLocalShipping, MdDesktopWindows, MdCameraAlt, MdEvent, MdComputer,
  MdAccountBalance, MdPayments, MdCurrencyExchange, MdRequestQuote, MdShield, MdGavel, MdRealEstateAgent
} from 'react-icons/md';

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
  'Restaurant': MdRestaurant,
  'Fast Food': MdFastfood,
  'Carinderia / Eatery': MdLocalDining,
  'Cafe / Coffee Shop': MdLocalCafe,
  'Bakery / Pastry Shop': LuCroissant,
  'Snack House / Grill': MdOutdoorGrill,
  'Food Cart / Street Food': MdStorefront,
  'Catering Service': MdRoomService,
  'Supermarket': MdLocalMall,
  'Grocery Store': MdShoppingCart,
  'Convenience Store': MdStore,
  'Sari-Sari Store': MdStorefront,
  'Rice Dealer': GiGrain,
  'Meat Shop / Butcher': MdSetMeal,
  'Fresh Produce / Market Stall': IoIosBasket,
  'Hardware & Construction Supply': MdHardware,
  'Agri-Vet Supply': GiPig,
  'Pet Shop': MdPets,
  'Pharmacy / Drugstore': MdLocalPharmacy,
  'Bookstore / School Supply': MdMenuBook,
  'Gift & Flower Shop': MdCardGiftcard,
  'Furniture Store': MdChair,
  'Appliance Store': IoTvSharp,
  'Electronics & Gadgets': MdDevices,
  'Clothing / Apparel Boutique': FaTshirt,
  'Ukay-Ukay': MdCheckroom,
  'Jewelry & Watches': MdWatch,
  'LPG Dealer': MdPropaneTank,
  'Beauty Salon': MdFaceRetouchingNatural,
  'Barbershop': MdContentCut,
  'Massage / Spa': MdSpa,
  'Skin Care Clinic': MdFaceRetouchingNatural,
  'Tattoo Studio': MdBrush,
  'Beauty Supply Store': MdShoppingBag,
  'Hospital': MdLocalHospital,
  'Medical Clinic': PiStethoscope,
  'Dental Clinic': FaTooth, 
  'Optical Clinic': FaEye, 
  'Diagnostic Clinic / Lab': HiMiniBeaker,
  'Veterinary Clinic': MdPets,
  'Gym / Fitness Center': MdFitnessCenter,
  'Gas Station': MdLocalGasStation,
  'Car Dealer': MdDirectionsCar,
  'Motorcycle Dealer': MdTwoWheeler,
  'Auto / Motorcycle Repair & Parts': MdBuild,
  'Vulcanizing / Tire Shop': MdTireRepair,
  'Car Wash / Detailing': MdLocalCarWash,
  'Driving School': MdSchool,
  'Hotel': MdHotel,
  'Resort': FaUmbrellaBeach,
  'Inn / Guesthouse': MdBed,
  'Travel Agency': MdFlight,
  'Vehicle Rental': MdCarRental,
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

export const CustomMapPin = ({ category, industry, storeName, showLabel = true, isDotMode = false, size = 30 }) => {
  const pinColor = CATEGORY_COLORS[category] || '#1E293B';
  const Icon = INDUSTRY_ICONS[industry] || CATEGORY_FALLBACK_ICONS[category] || MdStorefront;

  if (isDotMode) {
    return (
      <div style={{
        width: '12px',
        height: '12px',
        backgroundColor: pinColor,
        borderRadius: '50%',
        border: '2px solid #FFFFFF',
        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
        cursor: 'pointer'
      }} />
    );
  }

  return (
    <div style={{
      position: 'relative', 
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
    }}>
      <div style={{
        position: 'relative',
        width: `${size}px`,
        height: `${size * 1.15}px`, 
        display: 'flex',
        justifyContent: 'center',
        transition: 'transform 0.2s ease, filter 0.2s ease',
        zIndex: 2 
      }}>
        <div style={{ position: 'absolute', bottom: '-2px', width: '10px', height: '3px', backgroundColor: 'rgba(0, 0, 0, 0.4)', borderRadius: '50%', filter: 'blur(1px)', zIndex: 0 }} />
        <svg viewBox="0 0 32 40" style={{ position: 'absolute', width: '100%', height: '100%', top: 0, left: 0, zIndex: 1, filter: 'drop-shadow(0px 2px 3px rgba(0,0,0,0.2))' }}>
          <path d="M16 0 C7.16 0 0 7.16 0 16 C0 24 12 36 15 39 C15.5 39.5 16.5 39.5 17 39 C20 36 32 24 32 16 C32 7.16 24.84 0 16 0 Z" fill="#FFFFFF" />
        </svg>
        <div style={{ position: 'absolute', top: '6%', width: `${size * 0.76}px`, height: `${size * 0.76}px`, backgroundColor: pinColor, borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#FFFFFF', zIndex: 2 }}>
          <Icon size={size * 0.45} />
        </div>
      </div>
      
      {/* 🚀 UPDATED: Perfectly centered vertically with the circular part of the pin */}
      {showLabel && storeName && (
        <div style={{
          position: 'absolute',
          left: '100%', 
          marginLeft: '2px', // Brought closer to the pin without touching
          top: '38%', // Center of the bulbous part of the map pin
          transform: 'translateY(-50%)', // Anchors the text vertically exactly on the 38% mark
          fontSize: '11.5px',
          fontWeight: '900',
          fontFamily: '"Plus Jakarta Sans", sans-serif',
          color: pinColor,
          whiteSpace: 'nowrap',
          textShadow: '1px 1px 0 #fff, -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 0px 1px 0 #fff, 0px -1px 0 #fff, -1px 0px 0 #fff, 1px 0px 0 #fff, 0px 2px 4px rgba(0,0,0,0.2)',
          zIndex: 3,
          pointerEvents: 'none' 
        }}>
          {storeName}
        </div>
      )}
    </div>
  );
};