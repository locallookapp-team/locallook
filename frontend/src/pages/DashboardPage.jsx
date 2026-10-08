import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import Cropper from 'react-easy-crop';
import { QRCodeCanvas } from 'qrcode.react'; 
import { supabase } from '../supabaseClient'; 
import MerchantOnboarding from '../components/MerchantOnboarding';
import StoreScheduleModal from '../components/StoreScheduleModal';
import { 
  MdDragIndicator, MdSmartphone, MdChevronLeft, MdChevronRight, MdOutlineNearMe, 
  MdEdit, MdDelete, MdAdd, MdCameraAlt, MdDashboard, MdPeople, MdSecurity, 
  MdLocalOffer, MdRocketLaunch, MdPayment, MdRestaurantMenu, MdCheckCircle, 
  MdCancel, MdWarning, MdClose, MdSettings, MdStorefront, MdVerifiedUser, MdUploadFile,
  MdInsertDriveFile, MdStar, MdReply, MdMoreVert, MdDesktopMac, MdQrCode,
  MdLocationOn, MdVisibility, MdLock, MdSchedule, MdPalette
} from "react-icons/md";

import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';

const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) 
  ? import.meta.env.VITE_API_URL 
  : 'https://locallook-api.onrender.com';

const MAPBOX_TOKEN = (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_MAPBOX_TOKEN : '') || '';
if (MAPBOX_TOKEN) { mapboxgl.accessToken = MAPBOX_TOKEN; }

const BUSINESS_TAXONOMY = {
  'Food & Dining': ['Restaurant', 'Fast Food', 'Carinderia / Eatery', 'Cafe / Coffee Shop', 'Bakery / Pastry Shop', 'Snack House / Grill', 'Food Cart / Street Food', 'Catering Service'],
  'Grocery & Retail': ['Supermarket', 'Grocery Store', 'Convenience Store', 'Sari-Sari Store', 'Water Refilling Station', 'Rice Dealer', 'Meat Shop / Butcher', 'Fresh Produce / Market Stall', 'Hardware & Construction Supply', 'Agri-Vet Supply', 'Pet Shop', 'Pharmacy / Drugstore', 'Bookstore / School Supply', 'Gift & Flower Shop', 'Furniture Store', 'Appliance Store', 'Electronics & Gadgets', 'Clothing / Apparel Boutique', 'Ukay-Ukay', 'Jewelry & Watches', 'LPG Dealer'],
  'Beauty & Personal Care': ['Beauty Salon', 'Barbershop', 'Massage / Spa', 'Skin Care Clinic', 'Tattoo Studio', 'Beauty Supply Store'],
  'Health & Medical': ['Hospital', 'Medical Clinic', 'Dental Clinic', 'Optical Clinic', 'Diagnostic Clinic / Lab', 'Veterinary Clinic', 'Gym / Fitness Center'],
  'Automotive': ['Gas Station', 'Car Dealer', 'Motorcycle Dealer', 'Auto / Motorcycle Repair & Parts', 'Vulcanizing / Tire Shop', 'Car Wash / Detailing', 'Driving School'],
  'Travel & Accommodation': ['Hotel', 'Resort', 'Inn / Guesthouse', 'Travel Agency', 'Vehicle Rental'],
  'Home & Professional Services': ['Laundry Shop', 'Tailor / Dress Shop', 'Printing / Copy Center', 'Gadget Repair', 'Appliance / AC Repair', 'Home Repair / Handyman', 'Glass & Aluminum', 'Courier & Freight Service', 'Internet Cafe', 'Photography / Video Studio', 'Event Services & Rentals', 'IT Services'],
  'Financial & Business': ['Bank / ATM', 'Pawnshop / Remittance', 'Money Changer', 'Lending / Cooperative', 'Insurance Agency', 'Law & Accounting Office', 'Real Estate Office']
};

const PRESET_COLORS = ['#DC2626', '#EA580C', '#F59E0B', '#EAB308', '#84CC16', '#10B981', '#06B6D4', '#3B82F6', '#000000', '#EC4899'];

const fetchAddressFromCoords = async (lng, lat) => {
  if (!MAPBOX_TOKEN) return '';
  try {
    const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}`);
    const data = await res.json();
    return data.features?.[0]?.place_name || '';
  } catch (e) { return ''; }
};

const createImage = (url) => new Promise((resolve, reject) => {
  const image = new Image(); image.addEventListener('load', () => resolve(image)); image.addEventListener('error', (error) => reject(error));
  image.setAttribute('crossOrigin', 'anonymous'); image.src = url;
});

const getCroppedImg = async (imageSrc, pixelCrop, maxWidth = 1200) => {
  const image = await createImage(imageSrc); 
  const canvas = document.createElement('canvas'); 
  const ctx = canvas.getContext('2d');
  if (!ctx) return null; 

  let scale = 1;
  if (pixelCrop.width > maxWidth) {
    scale = maxWidth / pixelCrop.width;
  }

  canvas.width = pixelCrop.width * scale; 
  canvas.height = pixelCrop.height * scale;

  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, canvas.width, canvas.height);
  
  return new Promise((resolve) => { 
    canvas.toBlob((file) => { if (file) resolve(new File([file], "cropped-image.jpg", { type: "image/jpeg" })); }, 'image/jpeg', 0.8); 
  });
};

const getStoreCoverImage = (store) => {
  if (store?.cover_image_url) return store.cover_image_url;
  switch (store?.store_category) {
    case 'Food & Dining': return 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80';
    case 'Retail': return 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&q=80';
    case 'Services': return 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1200&q=80';
    case 'Groceries': return 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&q=80';
    default: return 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80';
  }
};

function SortableCategory({ id, activeCategory, brandColor, onClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : 1, position: 'relative', flexShrink: 0 };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <button onClick={() => onClick(id)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '20px', whiteSpace: 'nowrap', border: 'none', fontWeight: 'bold', fontSize: '13px', transition: isDragging ? 'none' : 'all 0.2s', backgroundColor: activeCategory === id ? brandColor : 'var(--surface-color)', color: activeCategory === id ? 'white' : 'var(--text-muted)', boxShadow: isDragging ? '0 10px 25px rgba(0,0,0,0.15)' : (activeCategory === id ? `0 4px 10px ${brandColor}40` : '0 1px 3px rgba(0,0,0,0.1)'), cursor: isDragging ? 'grabbing' : 'grab', opacity: isDragging ? 0.95 : 1, touchAction: 'none' }}>
        <MdDragIndicator size={16} style={{ opacity: 0.7, marginLeft: '-4px' }} />{id}
      </button>
    </div>
  );
}

function VerificationPanel({ store, userId, onStoreUpdate }) {
  const [dtiFile, setDtiFile] = useState(null);
  const [birFile, setBirFile] = useState(null);
  const [loading, setLoading] = useState(true); 
  const [message, setMessage] = useState(null);

  const [existingDti, setExistingDti] = useState(null);
  const [existingBir, setExistingBir] = useState(null);
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    const fetchFreshDocs = async () => {
      try {
        const { data } = await supabase.from('stores').select('dti_permit_url, bir_cor_url, is_verified').eq('id', store.id).single();
        if (data) {
          setExistingDti(data.dti_permit_url);
          setExistingBir(data.bir_cor_url);
          setIsVerified(data.is_verified);
          onStoreUpdate({ ...store, ...data });
        }
      } catch (err) {
        console.error("Error fetching fresh documents:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchFreshDocs();
  }, [store.id]);

  const handleFileSelect = (event, type) => {
    const file = event.target.files[0];
    if (!file) return;
    if (type === 'dti') setDtiFile(file);
    if (type === 'bir') setBirFile(file);
    setMessage(null);
  };

  const handleDeleteExisting = async (type) => {
    if (!window.confirm("Are you sure you want to permanently delete this document?")) return;
    setLoading(true); setMessage(null);
    try {
      const filePath = type === 'dti' ? existingDti : existingBir;
      const columnName = type === 'dti' ? 'dti_permit_url' : 'bir_cor_url';

      await supabase.storage.from('merchant-documents').remove([filePath]);
      const { error: dbErr } = await supabase.from('stores').update({ [columnName]: null }).eq('id', store.id);
      if (dbErr) throw dbErr;

      if (type === 'dti') setExistingDti(null);
      if (type === 'bir') setExistingBir(null);
      onStoreUpdate({ ...store, [columnName]: null });
      setMessage({ type: 'success', text: 'Document successfully removed.' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to delete: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitVerification = async () => {
    if (!existingDti && !dtiFile) return setMessage({ type: 'error', text: "Please provide your DTI/Mayor's Permit." });
    if (!existingBir && !birFile) return setMessage({ type: 'error', text: "Please provide your BIR Form 2303." });
    if (!dtiFile && !birFile) return; 

    try {
      setLoading(true); setMessage(null);
      const folderPath = `${userId}/${store.id}`;
      let newDtiPath = existingDti; let newBirPath = existingBir;

      if (dtiFile) {
        const dtiExt = dtiFile.name.split('.').pop();
        newDtiPath = `${folderPath}/dti-${Date.now()}.${dtiExt}`;
        const { error: dtiError } = await supabase.storage.from('merchant-documents').upload(newDtiPath, dtiFile);
        if (dtiError) throw dtiError;
      }
      if (birFile) {
        const birExt = birFile.name.split('.').pop();
        newBirPath = `${folderPath}/bir-${Date.now()}.${birExt}`;
        const { error: birError } = await supabase.storage.from('merchant-documents').upload(newBirPath, birFile);
        if (birError) throw birError;
      }

      const { error: dbError } = await supabase.from('stores').update({ dti_permit_url: newDtiPath, bir_cor_url: newBirPath }).eq('id', store.id);
      if (dbError) throw dbError;

      setExistingDti(newDtiPath); setExistingBir(newBirPath);
      onStoreUpdate({ ...store, dti_permit_url: newDtiPath, bir_cor_url: newBirPath });
      setDtiFile(null); setBirFile(null);
      setMessage({ type: 'success', text: "Documents securely saved! We will notify you once the Admin reviews them." });
    } catch (error) {
      setMessage({ type: 'error', text: `Upload failed: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  if (loading && !existingDti && !existingBir && !dtiFile && !birFile) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 'bold' }}>Syncing database records...</div>;

  if (isVerified) {
    return (
      <div style={{ padding: '20px', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10B981', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <MdVerifiedUser size={32} color="#10B981" />
        <div>
          <h3 style={{ margin: '0 0 4px 0', color: '#10B981', fontSize: '16px' }}>Officially Verified</h3>
          <p style={{ margin: 0, color: 'var(--text-main)', fontSize: '13px' }}>Your business documents have been reviewed and approved.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
      <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-main)', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <MdVerifiedUser size={20} color="var(--text-muted)" /> Business Verification Status
      </h3>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.5' }}>
        Submit your official documents to earn a Blue Verified Badge. This proves your store is legitimate, protects your brand, and builds trust with customers on the map.
      </p>

      {message && (
        <div style={{ padding: '12px', backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', border: `1px solid ${message.type === 'success' ? '#10B981' : '#EF4444'}`, color: message.type === 'success' ? '#10B981' : '#EF4444', borderRadius: '8px', fontSize: '13px', marginBottom: '20px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {message.type === 'success' ? <MdCheckCircle size={18} /> : <MdWarning size={18} />} {message.text}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
        
        {existingDti ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10B981', borderRadius: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <MdCheckCircle size={24} color="#10B981" />
              <div>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#10B981' }}>DTI / Mayor's Permit</p>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-main)' }}>Securely saved in database</p>
              </div>
            </div>
            <button onClick={() => handleDeleteExisting('dti')} disabled={loading} style={{ background: 'var(--surface-color)', border: '1px solid #EF4444', color: '#EF4444', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><MdDelete size={16} /> Delete</button>
          </div>
        ) : dtiFile ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: 'var(--surface-hover)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <MdInsertDriveFile size={24} color="var(--brand-primary)" />
              <div>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>DTI / Mayor's Permit</p>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>{dtiFile.name} (Ready to upload)</p>
              </div>
            </div>
            <button onClick={() => setDtiFile(null)} disabled={loading} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}><MdClose size={20} /></button>
          </div>
        ) : (
          <div style={{ border: '1px dashed var(--border-color)', padding: '20px', borderRadius: '8px', textAlign: 'center', backgroundColor: 'var(--surface-hover)', transition: 'background-color 0.2s' }}>
            <label style={{ cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <MdUploadFile size={28} color="var(--icon-color)" />
              <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>Upload DTI / Mayor's Permit</span>
              <input type="file" accept="image/*,.pdf" onChange={(e) => handleFileSelect(e, 'dti')} disabled={loading} style={{ display: 'none' }} />
            </label>
          </div>
        )}

        {existingBir ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10B981', borderRadius: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <MdCheckCircle size={24} color="#10B981" />
              <div>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#10B981' }}>BIR Form 2303 (COR)</p>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-main)' }}>Securely saved in database</p>
              </div>
            </div>
            <button onClick={() => handleDeleteExisting('bir')} disabled={loading} style={{ background: 'var(--surface-color)', border: '1px solid #EF4444', color: '#EF4444', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><MdDelete size={16} /> Delete</button>
          </div>
        ) : birFile ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: 'var(--surface-hover)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <MdInsertDriveFile size={24} color="var(--brand-primary)" />
              <div>
                <p style={{ margin: '0 0 2px 0', fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>BIR Form 2303 (COR)</p>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>{birFile.name} (Ready to upload)</p>
              </div>
            </div>
            <button onClick={() => setBirFile(null)} disabled={loading} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}><MdClose size={20} /></button>
          </div>
        ) : (
          <div style={{ border: '1px dashed var(--border-color)', padding: '20px', borderRadius: '8px', textAlign: 'center', backgroundColor: 'var(--surface-hover)', transition: 'background-color 0.2s' }}>
            <label style={{ cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <MdUploadFile size={28} color="var(--icon-color)" />
              <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>Upload BIR Certificate of Registration</span>
              <input type="file" accept="image/*,.pdf" onChange={(e) => handleFileSelect(e, 'bir')} disabled={loading} style={{ display: 'none' }} />
            </label>
          </div>
        )}

      </div>

      {(!existingDti || !existingBir) && (
        <button 
          onClick={handleSubmitVerification} disabled={loading || (!dtiFile && !birFile)} 
          style={{ width: '100%', padding: '14px', backgroundColor: 'var(--brand-primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: loading || (!dtiFile && !birFile) ? 'not-allowed' : 'pointer', opacity: (!dtiFile && !birFile) ? 0.5 : 1, transition: 'all 0.2s' }}
        >
          {loading ? 'Processing Documents...' : 'Submit Documents for Verification'}
        </button>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [stores, setStores] = useState([]);
  const [activeStore, setActiveStore] = useState(null);
  const [activeTab, setActiveTab] = useState('menu'); 
  const [items, setItems] = useState([]);
  const [storeOperators, setStoreOperators] = useState([]);
  const [loading, setLoading] = useState(true);

  const [storeReviews, setStoreReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [replyingToId, setReplyingToId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [activeReviewMenuId, setActiveReviewMenuId] = useState(null);

  const [isPreviewMobile, setIsPreviewMobile] = useState(true);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  const storeScrollRef = useRef(null);
  const storeDragState = useRef({ isDown: false, startX: 0, scrollLeft: 0 });
  const [showStoreLeft, setShowStoreLeft] = useState(false);
  const [showStoreRight, setShowStoreRight] = useState(false);

  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isEditStoreModalOpen, setIsEditStoreModalOpen] = useState(false);
  const [editStoreData, setEditStoreData] = useState({ 
    id: '', store_name: '', store_category: '', industry: '', description: '', phone: '', email: '', website: '', lat: '', lng: '', cover_image_url: '', logo_url: '',
    showPhone: false, showEmail: false, showWebsite: false, showAddress: false, addressText: '', theme_settings: {} 
  });
  
  const [isDeleteStoreModalOpen, setIsDeleteStoreModalOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');

  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', description: '', price: '', category: '', imageFile: null });
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false); 
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null); 
  
  const [categoryOrder, setCategoryOrder] = useState([]);
  const [activeCategory, setActiveCategory] = useState('');
  
  const scrollContainerRef = useRef(null);
  const sectionRefs = useRef({});
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  
  const [imageToCrop, setImageToCrop] = useState(null);
  const [cropType, setCropType] = useState('item'); 
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [croppedPreview, setCroppedPreview] = useState(null);

  const [storeTheme, setStoreTheme] = useState({ primaryColor: 'var(--brand-primary)', layout: 'grid' });
  const [isSavingTheme, setIsSavingTheme] = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState(null);

  const [subscription, setSubscription] = useState({ plan_type: 'free', end_date: null });
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [checkoutPromoCode, setCheckoutPromoCode] = useState('');

  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherMessage, setVoucherMessage] = useState(null);

  const editMapContainer = useRef(null);
  const editMap = useRef(null);
  const editPinRef = useRef(null);
  const editStoreRef = useRef(editStoreData);
  useEffect(() => { editStoreRef.current = editStoreData; }, [editStoreData]);

  const getAuthHeaders = async (isJson = true) => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = { 'Authorization': `Bearer ${session?.access_token}` };
    if (isJson) headers['Content-Type'] = 'application/json';
    return headers;
  };

  const handleHeaderMouseDown = (e) => {
    storeDragState.current.isDown = true;
    if (storeScrollRef.current) {
      storeScrollRef.current.style.cursor = 'grabbing';
      storeDragState.current.startX = e.pageX - storeScrollRef.current.offsetLeft;
      storeDragState.current.scrollLeft = storeScrollRef.current.scrollLeft;
    }
  };
  const handleHeaderMouseLeave = () => {
    storeDragState.current.isDown = false;
    if (storeScrollRef.current) storeScrollRef.current.style.cursor = 'grab';
  };
  const handleHeaderMouseUp = () => {
    storeDragState.current.isDown = false;
    if (storeScrollRef.current) storeScrollRef.current.style.cursor = 'grab';
  };
  const handleHeaderMouseMove = (e) => {
    if (!storeDragState.current.isDown) return;
    e.preventDefault();
    if (storeScrollRef.current) {
      const x = e.pageX - storeScrollRef.current.offsetLeft;
      const walk = (x - storeDragState.current.startX) * 1.5;
      storeScrollRef.current.scrollLeft = storeDragState.current.scrollLeft - walk;
    }
  };

  const checkHeaderScroll = () => {
    if (!storeScrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = storeScrollRef.current;
    setShowStoreLeft(scrollLeft > 0);
    setShowStoreRight(scrollLeft < scrollWidth - clientWidth - 5);
  };

  useEffect(() => {
    checkHeaderScroll();
    window.addEventListener('resize', checkHeaderScroll);
    return () => window.removeEventListener('resize', checkHeaderScroll);
  }, [stores]);

  useEffect(() => {
    const initDashboard = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate('/login'); return; }
      setUser(session.user);
      fetchStores(session.user.id);
    };
    initDashboard();
  }, [navigate]);

  const fetchStores = async (userId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/merchant/stores/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setStores(data);
        if (data.length > 0 && !activeStore) setActiveStore(data[0]); 
      }
    } catch (err) { console.error("Failed to fetch stores:", err); } finally { setLoading(false); }
  };

  const fetchSubscription = async (storeId) => {
    try {
      const { data } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('store_id', storeId)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle(); 

      if (data) {
        setSubscription(data); 
      } else {
        setSubscription({ plan_type: 'free', end_date: null });
      }
    } catch (err) { 
      console.error(err); 
    }
  };

  const fetchStoreReviews = async () => {
    setLoadingReviews(true);
    try {
      const { data, error } = await supabase.from('reviews').select('id, rating, comment, photo_urls, created_at, reviewer_name, owner_reply, owner_reply_created_at').eq('store_id', activeStore.id).order('created_at', { ascending: false });
      if (error) throw error;
      setStoreReviews(data || []);
    } catch (err) { console.error("Failed to fetch reviews:", err); } finally { setLoadingReviews(false); }
  };

  useEffect(() => {
    if (activeStore?.id) {
      fetch(`${API_BASE_URL}/api/stores/${activeStore.id}`)
        .then(res => res.json())
        .then(data => { 
          const theme = data.theme_settings || {};
          if (theme.primaryColor) setStoreTheme(theme); 
          if (theme.categoryOrder) setCategoryOrder(theme.categoryOrder);
          setEditStoreData({ 
            id: data.id, store_name: data.store_name, store_category: data.store_category, industry: data.industry || '', description: data.description || '', 
            phone: data.phone || '', email: data.email || '', website: data.website || '', lat: data.lat, lng: data.lng,
            cover_image_url: data.cover_image_url || '', logo_url: data.logo_url || '', showPhone: !!theme.showPhone, showEmail: !!theme.showEmail, showWebsite: !!theme.showWebsite, showAddress: !!theme.showAddress, 
            addressText: theme.addressText || '', theme_settings: theme
          });
        }).catch(err => console.error(err));

      fetch(`${API_BASE_URL}/api/stores/${activeStore.id}/items`).then(res => res.json()).then(data => setItems(data)).catch(err => console.error(err));
      
      getAuthHeaders().then(headers => {
        fetch(`${API_BASE_URL}/api/stores/${activeStore.id}/operators`, { headers }).then(res => res.ok ? res.json() : []).then(data => setStoreOperators(data)).catch(err => console.error(err));
      });

      fetchSubscription(activeStore.id);
      if (activeTab === 'reviews') fetchStoreReviews();
    }
  }, [activeStore?.id]);

  useEffect(() => {
    if (!activeStore?.id) return;

    const storeChannel = supabase.channel(`realtime-store-${activeStore.id}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'stores', 
        filter: `id=eq.${activeStore.id}` 
      }, (payload) => {
        if (payload.new) {
          setActiveStore(prev => ({ ...prev, is_open: payload.new.is_open }));
          setStores(prevStores => prevStores.map(s => 
            s.id === payload.new.id ? { ...s, is_open: payload.new.is_open } : s
          ));
        }
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(storeChannel); 
    };
  }, [activeStore?.id]);

  useEffect(() => {
    if (activeTab === 'reviews' && activeStore?.id) fetchStoreReviews();
  }, [activeTab]);

  useEffect(() => {
    const uniqueCats = [...new Set(items.map(i => i.item_category || 'Uncategorized'))];
    setCategoryOrder(prevOrder => {
      const newOrder = [...prevOrder];
      uniqueCats.forEach(c => { if (!newOrder.includes(c)) newOrder.push(c); });
      return newOrder.filter(c => uniqueCats.includes(c)); 
    });
  }, [items]);

  useEffect(() => {
    if (isEditStoreModalOpen && editMapContainer.current && !editMap.current) {
      editMap.current = new mapboxgl.Map({
        container: editMapContainer.current, style: 'mapbox://styles/locallook/cmqttzcqe004h01rc8ya580zb', center: [editStoreData.lng || 121.9823, editStoreData.lat || 12.3985], zoom: 15.5, pitch: 45, attributionControl: false 
      });
      if (editStoreData.lng && editStoreData.lat) {
        const el = document.createElement('div');
        el.innerHTML = `<div style="background-color: var(--brand-primary); width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.5); transform: translateY(-12px);"></div>`;
        editPinRef.current = new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat([editStoreData.lng, editStoreData.lat]).addTo(editMap.current);
      }
      editMap.current.on('click', async (e) => {
        const lng = e.lngLat.lng.toFixed(6); const lat = e.lngLat.lat.toFixed(6);
        let addressText = editStoreRef.current.addressText;
        if (editStoreRef.current.showAddress) addressText = await fetchAddressFromCoords(lng, lat);
        setEditStoreData(prev => ({ ...prev, lat, lng, addressText }));
        if (!editPinRef.current) {
          const el = document.createElement('div');
          el.innerHTML = `<div style="background-color: var(--brand-primary); width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.5); transform: translateY(-12px);"></div>`;
          editPinRef.current = new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat([lng, lat]).addTo(editMap.current);
        } else { editPinRef.current.setLngLat([lng, lat]); }
      });
    }
    return () => { if (!isEditStoreModalOpen && editMap.current) { editMap.current.remove(); editMap.current = null; editPinRef.current = null; } };
  }, [isEditStoreModalOpen, editStoreData.lng, editStoreData.lat]);

  const handleLocateMerchant = (mapRef, isEditing) => {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { longitude, latitude } = pos.coords;
        const lng = longitude.toFixed(6); const lat = latitude.toFixed(6);
        mapRef.current.flyTo({ center: [lng, lat], zoom: 18.5, speed: 1.5 });
        if (isEditing) {
          let addressText = editStoreRef.current.addressText;
          if (editStoreRef.current.showAddress) addressText = await fetchAddressFromCoords(lng, lat);
          setEditStoreData(prev => ({ ...prev, lat, lng, addressText }));
          if (editPinRef.current) editPinRef.current.setLngLat([lng, lat]);
        }
      },
      (err) => alert("Could not access location. Check permissions."), { enableHighAccuracy: true }
    );
  };

  const handleScroll = () => {
    if (activeTab !== 'menu' || !scrollContainerRef.current) return;
    const containerTop = scrollContainerRef.current.getBoundingClientRect().top;
    let currentActive = activeCategory; let minDistance = Infinity;
    categoryOrder.forEach(cat => {
      const el = sectionRefs.current[cat];
      if (el) {
        const distance = Math.abs(el.getBoundingClientRect().top - containerTop - 140); 
        if (distance < minDistance) { minDistance = distance; currentActive = cat; }
      }
    });
    if (currentActive !== activeCategory) setActiveCategory(currentActive);
  };

  const scrollToCategory = (cat) => {
    const el = sectionRefs.current[cat]; const container = scrollContainerRef.current;
    if (el && container) { container.scrollTo({ top: el.offsetTop - 140, behavior: 'smooth' }); }
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) setCategoryOrder((items) => arrayMove(items, items.indexOf(active.id), items.indexOf(over.id)));
  };

  const onItemFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader(); reader.readAsDataURL(e.target.files[0]);
      reader.onload = () => { setImageToCrop(reader.result); setCropType('item'); }; 
      e.target.value = null; 
    }
  };

  const onCoverFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader(); reader.readAsDataURL(e.target.files[0]);
      reader.onload = () => { setImageToCrop(reader.result); setCropType('cover'); }; 
      e.target.value = null; 
    }
  };

  const onLogoFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader(); reader.readAsDataURL(e.target.files[0]);
      reader.onload = () => { setImageToCrop(reader.result); setCropType('logo'); }; 
      e.target.value = null; 
    }
  };

  const onCropComplete = (croppedArea, croppedAreaPixels) => setCroppedAreaPixels(croppedAreaPixels);
  
  const handleSaveCrop = async () => {
    try {
      const maxWidth = cropType === 'cover' ? 1200 : (cropType === 'logo' ? 400 : 800);
      const croppedFile = await getCroppedImg(imageToCrop, croppedAreaPixels, maxWidth);
      if (cropType === 'item') {
        setNewItem({ ...newItem, imageFile: croppedFile }); 
        setCroppedPreview(URL.createObjectURL(croppedFile));
      } else if (cropType === 'cover') {
        handleCoverUploadFinal(croppedFile);
      } else if (cropType === 'logo') {
        handleLogoUploadFinal(croppedFile);
      }
      setImageToCrop(null); 
    } catch (e) { console.error(e); }
  };

  const handleCoverUploadFinal = async (file) => {
    setIsUploadingCover(true);
    try {
      if (activeStore.cover_image_url) {
         const oldPath = activeStore.cover_image_url.split('/store-covers/')[1];
         if (oldPath) await supabase.storage.from('store-covers').remove([oldPath]);
      }
      const fileExt = 'jpg'; 
      const filePath = `${activeStore.id}/${activeStore.id}-cover-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('store-covers').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('store-covers').getPublicUrl(filePath);
      
      const response = await fetch(`${API_BASE_URL}/api/stores/${activeStore.id}`, { 
        method: 'PATCH', headers: await getAuthHeaders(), body: JSON.stringify({ cover_image_url: publicUrl }) 
      });
      if (!response.ok) throw new Error("Failed to save cover image to database.");

      setActiveStore({ ...activeStore, cover_image_url: publicUrl }); 
      setStores(stores.map(s => s.id === activeStore.id ? { ...s, cover_image_url: publicUrl } : s)); 
    } catch (err) { alert("Error uploading cover: " + err.message); } finally { setIsUploadingCover(false); }
  };

  const handleLogoUploadFinal = async (file) => {
    setIsUploadingLogo(true);
    try {
      if (activeStore.logo_url) {
         const oldPath = activeStore.logo_url.split('/avatars/')[1];
         if (oldPath) await supabase.storage.from('avatars').remove([oldPath]);
      }
      const fileExt = 'jpg'; 
      const filePath = `store-logos/${activeStore.id}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      
      const response = await fetch(`${API_BASE_URL}/api/stores/${activeStore.id}`, { 
        method: 'PATCH', headers: await getAuthHeaders(), body: JSON.stringify({ logo_url: publicUrl }) 
      });
      if (!response.ok) throw new Error("Failed to save logo to database.");

      setActiveStore({ ...activeStore, logo_url: publicUrl }); 
      setStores(stores.map(s => s.id === activeStore.id ? { ...s, logo_url: publicUrl } : s)); 
    } catch (err) { alert("Error uploading logo: " + err.message); } finally { setIsUploadingLogo(false); }
  };

  const handleLogout = async () => { await supabase.auth.signOut(); navigate('/'); };

  const toggleStoreStatus = async () => {
    try {
      const nextStatus = !activeStore.is_open;
      const response = await fetch(`${API_BASE_URL}/api/stores/${activeStore.id}/toggle`, { 
        method: 'PATCH', 
        headers: await getAuthHeaders(), 
        body: JSON.stringify({ is_open: nextStatus }) 
      });
      
      if (response.ok) { 
        setActiveStore({ ...activeStore, is_open: nextStatus }); 
        setStores(stores.map(s => s.id === activeStore.id ? { ...s, is_open: nextStatus } : s)); 
      } else {
        const errData = await response.json();
        alert(`Failed to toggle status: ${errData.error || 'Server rejected the update.'}`);
      }
    } catch (err) {
      alert("Network Error: " + err.message);
    }
  };

  const handleOpenEditModal = () => {
    try {
      setEditStoreData({ 
        ...editStoreData, 
        id: activeStore.id, 
        store_name: activeStore.store_name, 
        store_category: activeStore.store_category, 
        industry: activeStore.industry || '', 
        description: activeStore.description || '', 
        phone: activeStore.phone || '', 
        email: activeStore.email || '', 
        website: activeStore.website || '', 
        lat: activeStore.lat, 
        lng: activeStore.lng, 
        showPhone: !!activeStore.theme_settings?.showPhone, 
        showEmail: !!activeStore.theme_settings?.showEmail, 
        showWebsite: !!activeStore.theme_settings?.showWebsite, 
        showAddress: !!activeStore.theme_settings?.showAddress, 
        addressText: activeStore.theme_settings?.addressText || '' 
      });
      setIsEditStoreModalOpen(true);
    } catch (err) {
      alert("Error loading store data. Check console for details.");
    }
  };
  
  const handleUpdateSettings = async (e) => {
    e.preventDefault(); if (!editStoreData.lat || !editStoreData.lng) return alert("Please drop a pin on the map!"); setIsUploading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/stores/${editStoreData.id}`, {
        method: 'PATCH', headers: await getAuthHeaders(), 
        body: JSON.stringify({ 
          store_name: editStoreData.store_name, store_category: editStoreData.store_category, industry: editStoreData.industry, description: editStoreData.description, 
          phone: editStoreData.phone, email: editStoreData.email, website: editStoreData.website, lat: editStoreData.lat, lng: editStoreData.lng, location: `POINT(${editStoreData.lng} ${editStoreData.lat})`
        })
      });
      if (response.ok) {
        const updatedStore = await response.json();
        const themeUpdate = { ...storeTheme, categoryOrder, showPhone: editStoreData.showPhone, showEmail: editStoreData.showEmail, showWebsite: editStoreData.showWebsite, showAddress: editStoreData.showAddress, addressText: editStoreData.addressText };
        await fetch(`${API_BASE_URL}/api/stores/${editStoreData.id}/theme`, { method: 'PATCH', headers: await getAuthHeaders(), body: JSON.stringify({ theme_settings: themeUpdate }) });
        const fullyUpdatedStore = { ...updatedStore, theme_settings: themeUpdate };
        setStores(stores.map(s => s.id === fullyUpdatedStore.id ? { ...s, ...fullyUpdatedStore } : s)); setActiveStore({ ...activeStore, ...fullyUpdatedStore }); 
        setIsEditStoreModalOpen(false);
      }
    } catch (err) { alert("Failed to save settings."); } finally { setIsUploading(false); }
  };

  const handleSelectColor = async (color) => {
    const updatedTheme = { ...storeTheme, primaryColor: color };
    setStoreTheme(updatedTheme);
    setIsSavingTheme(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/stores/${activeStore.id}/theme`, { 
        method: 'PATCH', 
        headers: await getAuthHeaders(), 
        body: JSON.stringify({ theme_settings: { ...updatedTheme, categoryOrder } }) 
      });
      if (!response.ok) throw new Error("Failed to save theme");
      setActiveStore(prev => ({ ...prev, theme_settings: { ...updatedTheme, categoryOrder } }));
    } catch (err) { 
      alert("Error saving color: " + err.message); 
    } finally { 
      setIsSavingTheme(false); 
    }
  };

  const handleDeleteStore = async () => {
    if (deleteConfirmationText !== activeStore.store_name) return; setIsUploading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/stores/${activeStore.id}`, { method: 'DELETE', headers: await getAuthHeaders(false) });
      if (response.ok) { 
        const updatedStores = stores.filter(s => s.id !== activeStore.id); setStores(updatedStores); 
        if (updatedStores.length > 0) { setActiveStore(updatedStores[0]); } else { setActiveStore(null); }
        setIsDeleteStoreModalOpen(false); setIsEditStoreModalOpen(false);
      }
    } catch (err) { alert("Failed to delete store."); } finally { setIsUploading(false); }
  };

  const openAddModal = () => { setEditingItemId(null); setNewItem({ name: '', description: '', price: '', category: '', imageFile: null }); setCroppedPreview(null); setIsItemModalOpen(true); };
  const closeItemModal = () => { setIsItemModalOpen(false); setEditingItemId(null); setNewItem({ name: '', description: '', price: '', category: '', imageFile: null }); setCroppedPreview(null); };
  const startEditItem = (item) => { setEditingItemId(item.id); setNewItem({ name: item.item_name, description: item.description || '', price: item.price, category: item.item_category, imageFile: null }); setCroppedPreview(item.image_url || null); setIsItemModalOpen(true); };

  const handleAddItem = async (e) => {
    e.preventDefault(); setIsUploading(true); let finalImageUrl = null;
    if (newItem.imageFile) {
      if (editingItemId) {
         const existingItem = items.find(i => i.id === editingItemId);
         if (existingItem?.image_url) {
            const oldPath = existingItem.image_url.split('/item-images/')[1];
            if (oldPath) await supabase.storage.from('item-images').remove([oldPath]);
         }
      }
      const fileName = `${Date.now()}.${newItem.imageFile.name.split('.').pop() || 'jpg'}`; 
      const filePath = `${activeStore.id}/${fileName}`;
      await supabase.storage.from('item-images').upload(filePath, newItem.imageFile); 
      finalImageUrl = supabase.storage.from('item-images').getPublicUrl(filePath).data.publicUrl;
    }
    if (editingItemId && !newItem.imageFile) {
      const existingItem = items.find(i => i.id === editingItemId);
      finalImageUrl = existingItem?.image_url;
    }
    const payload = { item_name: newItem.name, description: newItem.description, price: parseFloat(newItem.price), image_url: finalImageUrl, item_category: newItem.category };
    if (editingItemId) {
      const response = await fetch(`${API_BASE_URL}/api/items/${editingItemId}`, { method: 'PATCH', headers: await getAuthHeaders(), body: JSON.stringify(payload) });
      if (response.ok) { const updatedItem = await response.json(); setItems(items.map(i => i.id === editingItemId ? updatedItem : i)); closeItemModal(); }
    } else {
      const response = await fetch(`${API_BASE_URL}/api/items`, { method: 'POST', headers: await getAuthHeaders(), body: JSON.stringify({ store_id: activeStore.id, ...payload }) });
      if (response.ok) { const addedItem = await response.json(); setItems([addedItem, ...items]); closeItemModal(); }
    }
    setIsUploading(false);
  };

  const handleDeleteItem = async (itemId, itemName) => {
    if (!window.confirm(`Delete "${itemName}" permanently?`)) return;
    try {
      const itemToDelete = items.find(i => i.id === itemId);
      if (itemToDelete?.image_url) {
         const oldPath = itemToDelete.image_url.split('/item-images/')[1];
         if (oldPath) await supabase.storage.from('item-images').remove([oldPath]);
      }
      const response = await fetch(`${API_BASE_URL}/api/items/${itemId}`, { method: 'DELETE', headers: await getAuthHeaders(false) });
      if (response.ok) { setItems(items.filter(item => item.id !== itemId)); if (editingItemId === itemId) closeItemModal(); }
    } catch (err) { alert("Failed to delete item."); }
  };

  const handleRedeemVoucher = async () => {
    if (!voucherCode.trim()) return;
    setVoucherLoading(true); setVoucherMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/vouchers/redeem`, { method: 'POST', headers: await getAuthHeaders(), body: JSON.stringify({ store_id: activeStore.id, voucher_code: voucherCode }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to redeem voucher.");
      setVoucherMessage({ type: 'success', text: data.message });
      fetchSubscription(activeStore.id);
      setTimeout(() => setIsVoucherModalOpen(false), 2000);
    } catch (err) { setVoucherMessage({ type: 'error', text: err.message }); } finally { setVoucherLoading(false); }
  };

  const handleProceedToPayment = async () => {
    setIsProcessingPayment(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/create-checkout-session`, { method: 'POST', headers: await getAuthHeaders(), body: JSON.stringify({ store_id: activeStore.id, voucher_code: checkoutPromoCode.trim() || null }) });
      const data = await res.json();
      if (data.checkoutUrl) window.location.href = data.checkoutUrl; else throw new Error(data.error || "Failed to initiate payment");
    } catch (err) { alert("Error initiating payment: " + err.message); setIsProcessingPayment(false); }
  };

  const handleInviteOperator = async (e) => {
    e.preventDefault(); setIsInviting(true); setInviteMessage(null); 
    try {
      const response = await fetch(`${API_BASE_URL}/api/stores/${activeStore.id}/invite`, { method: 'POST', headers: await getAuthHeaders(), body: JSON.stringify({ email: inviteEmail, requester_id: user.id }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Failed to invite operator");
      setInviteMessage({ type: 'success', text: data.message });
      setStoreOperators([...storeOperators, { email: inviteEmail, status: data.message.includes('Existing') ? 'confirmed' : 'pending', role: 'operator' }]);
      setInviteEmail(''); 
    } catch (err) { setInviteMessage({ type: 'error', text: err.message }); } finally { setIsInviting(false); setTimeout(() => setInviteMessage(null), 6000); }
  };

  const handleRemoveStaff = async (staffId, staffEmail) => {
    if (!window.confirm(`Are you sure you want to remove ${staffEmail} from this store?`)) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/stores/${activeStore.id}/staff/${staffId}`, { method: 'DELETE', headers: await getAuthHeaders(false) });
      if (!response.ok) throw new Error("Failed to remove staff");
      setStoreOperators(storeOperators.filter(op => op.user_id !== staffId));
    } catch (error) { alert("Error: " + error.message); }
  };

  const submitReply = async (reviewId) => {
    if (!replyText.trim()) return;
    setIsSubmittingReply(true);
    try {
      const timestamp = new Date().toISOString();
      const { error } = await supabase.from('reviews').update({ owner_reply: replyText.trim(), owner_reply_created_at: timestamp }).eq('id', reviewId);
      if (error) throw error;
      setStoreReviews(prev => prev.map(r => r.id === reviewId ? { ...r, owner_reply: replyText.trim(), owner_reply_created_at: timestamp } : r));
      setReplyingToId(null); setReplyText('');
    } catch (err) { alert("Failed to submit reply: " + err.message); } finally { setIsSubmittingReply(false); }
  };

  const handleDeleteReply = async (reviewId) => {
    if (!window.confirm("Are you sure you want to delete your response?")) return;
    try {
      const { error } = await supabase.from('reviews').update({ owner_reply: null, owner_reply_created_at: null }).eq('id', reviewId);
      if (error) throw error;
      setStoreReviews(prev => prev.map(r => r.id === reviewId ? { ...r, owner_reply: null, owner_reply_created_at: null } : r));
      setActiveReviewMenuId(null);
    } catch (err) { alert("Failed to delete reply: " + err.message); }
  };

  const downloadQRCode = () => {
    const canvas = document.getElementById("qr-code-canvas");
    if (canvas) {
      const pngUrl = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
      let downloadLink = document.createElement("a"); downloadLink.href = pngUrl; downloadLink.download = `${activeStore.store_name.replace(/\s+/g, '-')}-QR.png`;
      document.body.appendChild(downloadLink); downloadLink.click(); document.body.removeChild(downloadLink);
    }
  };

  const handleOnboardingAction = (action) => {
    if (action === 'verify') setActiveTab('verification');
    if (action === 'menu') {
      setActiveTab('menu');
      if (!isMenuLocked) openAddModal();
    }
    if (action === 'premium') setIsUpgradeModalOpen(true);
  };

  const groupedItems = items.reduce((groups, item) => { const category = item.item_category || 'Uncategorized'; if (!groups[category]) groups[category] = []; groups[category].push(item); return groups; }, {});
  const isMenuLocked = !subscription || 
                       subscription.plan_type === 'free' || 
                       subscription.status !== 'active' || 
                       (subscription.end_date && new Date(subscription.end_date) <= new Date());

  const reviewCount = storeReviews.length;
  const avgRating = reviewCount > 0 ? (storeReviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount).toFixed(1) : 0;

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', backgroundColor: 'var(--bg-color)', padding: '30px' }}>
        <div style={{ height: '80px', width: '100%', maxWidth: '1000px', margin: '0 auto 30px auto', backgroundColor: 'var(--border-color)', borderRadius: '16px', animation: 'pulse 1.5s infinite' }} />
        <div style={{ height: '320px', width: '100%', maxWidth: '1000px', margin: '0 auto', backgroundColor: 'var(--border-color)', borderRadius: '24px', animation: 'pulse 1.5s infinite', marginBottom: '20px' }} />
        <div style={{ height: '40px', width: '100%', maxWidth: '1000px', margin: '0 auto', backgroundColor: 'var(--border-color)', borderRadius: '12px', animation: 'pulse 1.5s infinite', marginBottom: '20px' }} />
        <div style={{ height: '70px', width: '100%', maxWidth: '1000px', margin: '0 auto', backgroundColor: 'var(--border-color)', borderRadius: '16px', animation: 'pulse 1.5s infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', backgroundColor: 'var(--bg-color)', fontFamily: 'var(--font-main)', overflowY: 'auto', position: 'relative' }}>
      
      <style>{`.mapboxgl-ctrl-bottom-left, .mapboxgl-ctrl-bottom-right, .mapboxgl-ctrl-logo, .mapboxgl-ctrl-attrib { display: none !important; }`}</style>

      {/* 🚀 UNIVERSAL CROPPER MODAL */}
      {imageToCrop && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(15,23,42,0.95)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(5px)' }}>
          <div style={{ width: '100%', maxWidth: '800px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', color: 'white' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>
              {cropType === 'cover' ? 'Adjust Cover Photo (3:1)' : cropType === 'logo' ? 'Adjust Store Logo (1:1)' : 'Adjust Item Image (4:3)'}
            </h3>
            <button onClick={() => { setImageToCrop(null); setZoom(1); }} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><MdClose size={28} /></button>
          </div>
          
          <div style={{ position: 'relative', width: '100%', maxWidth: '800px', height: '60vh', backgroundColor: '#000', borderRadius: '16px', overflow: 'hidden', marginBottom: '20px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            <Cropper
              image={imageToCrop}
              crop={crop}
              zoom={zoom}
              aspect={cropType === 'cover' ? 3 / 1 : cropType === 'logo' ? 1 / 1 : 4 / 3}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
              objectFit="contain"
            />
          </div>
          
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', backgroundColor: 'var(--surface-color)', padding: '15px 30px', borderRadius: '50px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-muted)' }}>Zoom</span>
            <input type="range" value={zoom} min={1} max={3} step={0.1} onChange={(e) => setZoom(Number(e.target.value))} style={{ width: '150px', accentColor: 'var(--brand-primary)' }} />
            <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 5px' }} />
            <button onClick={() => { setImageToCrop(null); setZoom(1); }} style={{ padding: '10px 20px', backgroundColor: 'var(--surface-hover)', color: 'var(--text-muted)', border: 'none', borderRadius: '24px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSaveCrop} style={{ padding: '10px 24px', backgroundColor: 'var(--brand-primary)', color: 'white', border: 'none', borderRadius: '24px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}><MdCheckCircle size={18} /> Apply Crop</button>
          </div>
        </div>
      )}

      {/* --- MODALS (Voucher, Upgrade, Schedule, Edit Store, Item, Delete, QR) --- */}
      
      {isVoucherModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '30px', borderRadius: '20px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h2 style={{ margin: '0 0 15px 0', fontSize: '20px', color: 'var(--text-main)', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}><MdLocalOffer color="var(--brand-primary)" /> Redeem Free Days</h2>
            <input 
              type="text" 
              placeholder="ENTER FREE DAYS CODE" 
              value={voucherCode} 
              onChange={e => setVoucherCode(e.target.value.toUpperCase())} 
              style={{ width: '100%', padding: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', borderRadius: '10px', boxSizing: 'border-box', marginBottom: '15px', textTransform: 'uppercase' }} 
            />
            {voucherMessage && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '15px', fontSize: '13px', color: voucherMessage.type === 'success' ? '#10B981' : '#EF4444', fontWeight: 'bold' }}>
                {voucherMessage.type === 'success' ? <MdCheckCircle size={16} /> : <MdCancel size={16} />} {voucherMessage.text}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setIsVoucherModalOpen(false)} style={{ flex: 1, padding: '12px', backgroundColor: 'var(--surface-hover)', color: 'var(--text-main)', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleRedeemVoucher} disabled={voucherLoading || !voucherCode.trim()} style={{ flex: 1, padding: '12px', backgroundColor: 'var(--brand-primary)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: voucherLoading || !voucherCode.trim() ? 'not-allowed' : 'pointer' }}>{voucherLoading ? 'Redeeming...' : 'Redeem'}</button>
            </div>
          </div>
        </div>
      )}

      {isUpgradeModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '30px', borderRadius: '20px', width: '100%', maxWidth: '450px', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h2 style={{ margin: '0 0 10px 0', fontSize: '24px', color: 'var(--text-main)', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>Unlock Premium <MdRocketLaunch color="var(--brand-primary)" /></h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '25px', fontSize: '14px', lineHeight: '1.5' }}>Get full access to edit your menu, customize your store branding, and accept online orders.</p>
            
            <div style={{ marginBottom: '15px', textAlign: 'left' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '8px' }}>Have a percentage or fixed discount code?</label>
              <input 
                type="text" 
                placeholder="e.g. SUMMER20" 
                value={checkoutPromoCode} 
                onChange={e => setCheckoutPromoCode(e.target.value.toUpperCase())} 
                style={{ width: '100%', padding: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', borderRadius: '10px', boxSizing: 'border-box', textTransform: 'uppercase' }} 
              />
            </div>

            <div style={{ marginBottom: '15px', fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4', textAlign: 'center', padding: '0 10px' }}>
              By proceeding with this payment, you acknowledge that you have read and agree to our strictly non-refundable payment policy as outlined in our <a href="/terms" target="_blank" style={{ color: 'var(--brand-primary)', textDecoration: 'underline' }}>Terms of Service</a>.
            </div>

            <button onClick={handleProceedToPayment} disabled={isProcessingPayment} style={{ width: '100%', padding: '14px', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', fontWeight: 'bold', cursor: isProcessingPayment ? 'not-allowed' : 'pointer', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <MdPayment size={18} /> {isProcessingPayment ? 'Redirecting...' : 'Pay via GCash / Maya'}
            </button>
            
            <div style={{ margin: '20px 0', borderTop: '1px solid var(--border-color)', position: 'relative' }}>
               <span style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'var(--surface-color)', padding: '0 10px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'bold' }}>OR</span>
            </div>

            <button onClick={() => { setIsUpgradeModalOpen(false); setIsVoucherModalOpen(true); }} style={{ width: '100%', padding: '14px', backgroundColor: 'var(--brand-primary)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '5px', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <MdLocalOffer size={18} /> Claim Free Days
            </button>
            
            <button onClick={() => setIsUpgradeModalOpen(false)} style={{ marginTop: '15px', background: 'none', border: 'none', color: 'var(--text-muted)', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {isScheduleModalOpen && activeStore && (
        <StoreScheduleModal 
          store={activeStore}
          getAuthHeaders={getAuthHeaders}
          API_BASE_URL={API_BASE_URL}
          onClose={() => setIsScheduleModalOpen(false)}
          onSave={(updatedData) => {
            setActiveStore(prev => ({ ...prev, ...updatedData }));
            setStores(stores.map(s => s.id === updatedData.id ? { ...s, ...updatedData } : s));
          }}
        />
      )}

      {isEditStoreModalOpen && activeStore && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '30px', borderRadius: '20px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--text-main)', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}><MdSettings color="var(--brand-primary)" /> Edit Store Profile</h2>
              <button onClick={() => setIsEditStoreModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '24px', cursor: 'pointer', lineHeight: '1' }}><MdClose /></button>
            </div>
            
            <form onSubmit={handleUpdateSettings} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '5px' }}>Store Name</label>
                <input type="text" placeholder="Store Name" required value={editStoreData.store_name} onChange={(e) => setEditStoreData({...editStoreData, store_name: e.target.value})} style={{ padding: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', borderRadius: '10px', width: '100%', boxSizing: 'border-box' }} />
              </div>
              
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '5px' }}>Category</label>
                  <select required value={editStoreData.store_category} onChange={(e) => setEditStoreData({...editStoreData, store_category: e.target.value, industry: ''})} style={{ width: '100%', padding: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', borderRadius: '10px', boxSizing: 'border-box' }}>
                    <option value="" disabled>Select Category</option>
                    {Object.keys(BUSINESS_TAXONOMY).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '5px' }}>Industry</label>
                  <select required value={editStoreData.industry} onChange={(e) => setEditStoreData({...editStoreData, industry: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', borderRadius: '10px', boxSizing: 'border-box' }} disabled={!editStoreData.store_category}>
                    <option value="" disabled>Select Industry</option>
                    {editStoreData.store_category && BUSINESS_TAXONOMY[editStoreData.store_category]?.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '5px' }}>Store Description</label>
                <textarea placeholder="Store Description (Optional)" value={editStoreData.description} onChange={(e) => setEditStoreData({...editStoreData, description: e.target.value})} style={{ padding: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', borderRadius: '10px', width: '100%', boxSizing: 'border-box', minHeight: '80px', fontFamily: 'inherit' }} />
              </div>
              
              <div style={{ padding: '15px', backgroundColor: 'var(--surface-hover)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: 'var(--text-main)' }}>Contact Details</h4>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-main)', cursor: 'pointer', marginBottom: editStoreData.showPhone ? '10px' : '5px', fontWeight: 'bold' }}><input type="checkbox" checked={editStoreData.showPhone} onChange={(e) => setEditStoreData({...editStoreData, showPhone: e.target.checked})} /> Show Phone Number</label>
                {editStoreData.showPhone && (
                  <div style={{ marginBottom: '15px' }}>
                    <input type="tel" pattern="[0-9]*" placeholder="e.g. 09123456789" value={editStoreData.phone} onChange={(e) => setEditStoreData({...editStoreData, phone: e.target.value.replace(/\D/g, '')})} style={{ padding: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }} />
                  </div>
                )}
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-main)', cursor: 'pointer', marginBottom: editStoreData.showEmail ? '10px' : '5px', fontWeight: 'bold' }}><input type="checkbox" checked={editStoreData.showEmail} onChange={(e) => setEditStoreData({...editStoreData, showEmail: e.target.checked})} /> Show Email</label>
                {editStoreData.showEmail && (
                  <div style={{ marginBottom: '15px' }}>
                    <input type="email" placeholder="Business Email" value={editStoreData.email} onChange={(e) => setEditStoreData({...editStoreData, email: e.target.value})} style={{ padding: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }} />
                  </div>
                )}

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-main)', cursor: 'pointer', marginBottom: editStoreData.showWebsite ? '10px' : '5px', fontWeight: 'bold' }}><input type="checkbox" checked={editStoreData.showWebsite} onChange={(e) => setEditStoreData({...editStoreData, showWebsite: e.target.checked})} /> Show Website Link</label>
                {editStoreData.showWebsite && (
                  <div style={{ marginBottom: '15px' }}>
                    <input type="url" placeholder="https://yourstore.com" value={editStoreData.website} onChange={(e) => setEditStoreData({...editStoreData, website: e.target.value})} style={{ padding: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }} />
                  </div>
                )}
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-main)', cursor: 'pointer', marginBottom: editStoreData.showAddress ? '10px' : '0', fontWeight: 'bold' }}><input type="checkbox" checked={editStoreData.showAddress} onChange={async (e) => { const checked = e.target.checked; let text = editStoreData.addressText; if (checked && !text && editStoreData.lng) text = await fetchAddressFromCoords(editStoreData.lng, editStoreData.lat); setEditStoreData({...editStoreData, showAddress: checked, addressText: text}); }} /> Show Exact Street Address</label>
                {editStoreData.showAddress && (
                  <div style={{ marginTop: '10px' }}>
                    <input type="text" placeholder="Auto-detects when you drop a pin below" value={editStoreData.addressText} onChange={(e) => setEditStoreData({...editStoreData, addressText: e.target.value})} style={{ padding: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }} />
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '8px' }}>Store Location (Drag map to move pin)</label>
                <div style={{ position: 'relative', width: '100%', height: '240px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                  <div ref={editMapContainer} style={{ position: 'absolute', inset: 0 }} />
                  <div style={{ position: 'absolute', bottom: '10px', right: '10px', zIndex: 10 }}>
                    <button type="button" onClick={() => handleLocateMerchant(editMap, true)} style={{ width: '36px', height: '36px', backgroundColor: 'var(--surface-color)', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', border: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.15)', cursor: 'pointer' }}><MdOutlineNearMe size={20} color="var(--brand-primary)" style={{ transform: 'translate(-1px, 1px)' }} /></button>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', gap: '15px' }}>
                 <button type="submit" disabled={isUploading} style={{ flex: 1, padding: '14px', backgroundColor: 'var(--brand-primary)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: isUploading ? 'not-allowed' : 'pointer' }}>
                   {isUploading ? 'Saving...' : 'Save Profile Changes'}
                 </button>
                 {activeStore.merchant_id === user?.id && (
                   <button type="button" onClick={() => setIsDeleteStoreModalOpen(true)} style={{ padding: '14px 20px', backgroundColor: '#EF4444', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                     <MdDelete size={18} /> Delete Store
                   </button>
                 )}
              </div>
            </form>
          </div>
        </div>
      )}

      {isItemModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '30px', borderRadius: '20px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--text-main)', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>{editingItemId ? <><MdEdit color="var(--brand-primary)" /> Edit Item</> : <><MdAdd color="var(--brand-primary)" /> Add New Item</>}</h2>
              <button onClick={closeItemModal} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '24px', cursor: 'pointer', lineHeight: '1' }}><MdClose /></button>
            </div>
            <form onSubmit={handleAddItem} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                <div style={{ flex: '2 1 200px' }}><label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '4px' }}>Item Name</label><input type="text" placeholder="Item Name" required value={newItem.name} onChange={(e) => setNewItem({...newItem, name: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', borderRadius: '10px', boxSizing: 'border-box' }} /></div>
                <div style={{ flex: '1 1 100px' }}><label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '4px' }}>Price (₱)</label><input type="number" step="0.01" placeholder="Price" required value={newItem.price} onChange={(e) => setNewItem({...newItem, price: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', borderRadius: '10px', boxSizing: 'border-box' }} /></div>
              </div>
              <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                <div style={{ flex: '2 1 200px' }}><label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '4px' }}>Description (Optional)</label><input type="text" placeholder="Brief details about the item..." value={newItem.description} onChange={(e) => setNewItem({...newItem, description: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', borderRadius: '10px', boxSizing: 'border-box' }} /></div>
                <div style={{ flex: '1 1 150px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '4px' }}>Category Menu</label>
                  <input type="text" list="category-suggestions" placeholder="Category" required value={newItem.category} onChange={(e) => setNewItem({...newItem, category: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', borderRadius: '10px', boxSizing: 'border-box' }} />
                  <datalist id="category-suggestions"><option value="General" /><option value="Best Sellers" /><option value="Promos" /></datalist>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', padding: '15px', backgroundColor: 'var(--bg-color)', border: '1px dashed var(--border-color)', borderRadius: '12px', flexWrap: 'wrap', gap: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  {croppedPreview ? (
                    <div style={{ position: 'relative' }}>
                      <img src={croppedPreview} alt="Preview" style={{ width: '120px', height: '90px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                      <button type="button" onClick={() => { setCroppedPreview(null); setNewItem({...newItem, imageFile: null}) }} style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#EF4444', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MdClose /></button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <div><label htmlFor="item-upload" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}><MdCameraAlt size={16} color="var(--brand-primary)" /> Upload Image</label><input id="item-upload" type="file" accept="image/*" onChange={onItemFileSelect} style={{ display: 'none' }} /></div>
                    </div>
                  )}
                </div>
                <button type="submit" disabled={isUploading} style={{ padding: '10px 24px', backgroundColor: editingItemId ? '#F59E0B' : 'var(--brand-primary)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: isUploading ? 'not-allowed' : 'pointer' }}>{isUploading ? 'Saving...' : (editingItemId ? 'Update Item' : 'Save New Item')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleteStoreModalOpen && activeStore && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '30px', borderRadius: '20px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h2 style={{ margin: '0 0 15px 0', fontSize: '20px', color: '#DC2626', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}><MdWarning /> Delete Store</h2>
            <p style={{ margin: '0 0 20px 0', color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.5' }}>This action cannot be undone. This will permanently delete <strong>{activeStore.store_name}</strong> and all of its items.</p>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '8px' }}>Type <strong style={{ color: 'var(--text-main)' }}>{activeStore.store_name}</strong> to confirm:</label>
              <input type="text" value={deleteConfirmationText} onChange={(e) => setDeleteConfirmationText(e.target.value)} style={{ padding: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', borderRadius: '10px', width: '100%', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setIsDeleteStoreModalOpen(false)} style={{ flex: 1, padding: '12px', backgroundColor: 'var(--surface-hover)', color: 'var(--text-main)', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleDeleteStore} disabled={deleteConfirmationText !== activeStore.store_name || isUploading} style={{ flex: 1, padding: '12px', backgroundColor: '#DC2626', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: deleteConfirmationText !== activeStore.store_name || isUploading ? 'not-allowed' : 'pointer', opacity: deleteConfirmationText !== activeStore.store_name ? 0.5 : 1 }}>{isUploading ? 'Deleting...' : 'Delete Store'}</button>
            </div>
          </div>
        </div>
      )}

      {isQrModalOpen && activeStore && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '30px', borderRadius: '24px', width: '100%', maxWidth: '350px', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}><button onClick={() => setIsQrModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><MdClose size={24} /></button></div>
            <h2 style={{ margin: '0 0 5px 0', fontSize: '20px', fontWeight: '900', color: 'var(--text-main)' }}>Share your Store</h2>
            <p style={{ margin: '0 0 20px 0', color: 'var(--text-muted)', fontSize: '14px' }}>Print this code for customers to instantly access your digital menu and leave reviews.</p>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '25px', padding: '20px', backgroundColor: 'var(--bg-color)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
              <QRCodeCanvas id="qr-code-canvas" value={`${window.location.origin}/store/${activeStore.id}`} size={200} level={"H"} includeMargin={true} />
            </div>
            <button onClick={downloadQRCode} style={{ width: '100%', padding: '14px', backgroundColor: 'var(--brand-primary)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' }}>Download QR Image</button>
          </div>
        </div>
      )}

      {/* --- HEADER BAR --- */}
      <div style={{ height: '70px', flexShrink: 0, boxSizing: 'border-box', zIndex: 40, backgroundColor: 'var(--surface-color)', padding: '0 30px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', overflow: 'hidden', flexGrow: 1, marginRight: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: 'var(--text-main)', paddingRight: '15px', borderRight: '1px solid var(--border-color)', flexShrink: 0 }}>Merchant's Hub</h2>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', overflow: 'hidden', flexGrow: 1 }}>
            {showStoreLeft && <button onClick={() => storeScrollRef.current.scrollBy({ left: -200, behavior: 'smooth' })} style={{ position: 'absolute', left: 0, zIndex: 5, background: 'linear-gradient(to right, var(--surface-color) 70%, transparent)', border: 'none', height: '100%', padding: '0 10px 0 0', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><MdChevronLeft size={24} color="var(--text-main)" /></button>}
            <div ref={storeScrollRef} onScroll={checkHeaderScroll} onMouseDown={handleHeaderMouseDown} onMouseLeave={handleHeaderMouseLeave} onMouseUp={handleHeaderMouseUp} onMouseMove={handleHeaderMouseMove} style={{ display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none', padding: '5px 0', width: '100%', cursor: 'grab', userSelect: 'none' }}>
              {stores.map(s => <button key={s.id} onClick={() => setActiveStore(s)} style={{ flexShrink: 0, padding: '8px 16px', borderRadius: '20px', backgroundColor: activeStore?.id === s.id ? 'var(--brand-primary)' : 'transparent', color: activeStore?.id === s.id ? 'white' : 'var(--text-muted)', border: activeStore?.id === s.id ? '1px solid transparent' : '1px solid var(--border-color)', fontWeight: '700', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap', boxShadow: activeStore?.id === s.id ? '0 4px 10px rgba(37,99,235,0.2)' : 'none' }}>{s.store_name}</button>)}
              <button onClick={() => navigate('/create-business')} style={{ flexShrink: 0, padding: '8px 16px', borderRadius: '20px', backgroundColor: 'var(--surface-hover)', color: 'var(--brand-primary)', border: '1px dashed var(--brand-primary)', fontWeight: '700', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}><MdAdd size={16} /> Add Store</button>
            </div>
            {showStoreRight && <button onClick={() => storeScrollRef.current.scrollBy({ left: 200, behavior: 'smooth' })} style={{ position: 'absolute', right: 0, zIndex: 5, background: 'linear-gradient(to left, var(--surface-color) 70%, transparent)', border: 'none', height: '100%', padding: '0 0 0 10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><MdChevronRight size={24} color="var(--text-main)" /></button>}
          </div>
        </div>
        <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#EF4444', fontWeight: '700', cursor: 'pointer', fontSize: '14px', flexShrink: 0 }}>Sign Out</button>
      </div>

      <div ref={scrollContainerRef} onScroll={handleScroll} style={{ flexGrow: 1, padding: '30px', paddingBottom: '90px', position: 'relative', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        
        <MerchantOnboarding activeStoreId={activeStore?.id} onAction={handleOnboardingAction} />
        
        {stores.length === 0 && (
           <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <div style={{ width: '80px', height: '80px', backgroundColor: 'var(--surface-hover)', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '20px' }}><MdStorefront size={40} color="var(--brand-primary)" /></div>
              <h2 style={{ margin: '0 0 10px 0', color: 'var(--text-main)', fontSize: '24px', fontWeight: '900' }}>Welcome to LocalLook Hub</h2>
              <button onClick={() => navigate('/create-business')} style={{ padding: '14px 28px', backgroundColor: 'var(--brand-primary)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '800', fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(37, 99, 235, 0.2)' }}><MdAdd size={20} /> Register a Store</button>
           </div>
        )}

        {activeStore && (
          <div style={{ width: '100%', maxWidth: '1000px', margin: '0 auto' }}>
            
            <div style={{ position: 'relative', marginBottom: '60px' }}>
              <div style={{ width: '100%', height: '320px', borderRadius: '24px', overflow: 'hidden', backgroundImage: `url(${getStoreCoverImage(activeStore)})`, backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0) 100%)', pointerEvents: 'none' }} />
                
                <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 20 }}>
                   <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(4px)', color: '#0F172A', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', cursor: isUploadingCover ? 'not-allowed' : 'pointer', border: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                      {isUploadingCover ? 'Uploading...' : <><MdCameraAlt size={16} color="var(--brand-primary)" /> Edit Cover</>}
                      <input type="file" accept="image/*" onChange={onCoverFileSelect} disabled={isUploadingCover} style={{ display: 'none' }} />
                   </label>
                </div>

                <div style={{ position: 'absolute', bottom: '25px', left: '220px', right: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '15px', zIndex: 20 }}>
                  <div style={{ pointerEvents: 'auto' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h1 style={{ margin: 0, fontSize: '36px', color: 'white', fontWeight: '900', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>{activeStore.store_name}</h1>
                      {activeStore.role === 'operator' && <span style={{ padding: '4px 8px', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid #34d399', fontSize: '12px', fontWeight: 'bold', borderRadius: '6px' }}>STAFF</span>}
                    </div>
                    <p style={{ margin: '4px 0 12px 0', color: '#E2E8F0', fontSize: '15px', fontWeight: '600' }}>{activeStore.industry || activeStore.store_category}</p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', color: '#F8FAFC', fontSize: '14px', fontWeight: '500' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><MdLocationOn size={18} /> {activeStore.theme_settings?.addressText || 'Location not set'}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><MdStar size={18} /> {reviewCount > 0 ? `${avgRating} (${reviewCount} reviews)` : 'No reviews yet'}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><MdVisibility size={18} /> 1.2K views</div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ position: 'absolute', bottom: '-40px', left: '40px', width: '160px', height: '160px', borderRadius: '50%', border: '6px solid var(--surface-color)', backgroundColor: 'var(--surface-color)', zIndex: 30, backgroundImage: activeStore.logo_url ? `url(${activeStore.logo_url})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', boxShadow: '0 8px 25px rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {!activeStore.logo_url && <MdStorefront size={60} color="var(--icon-color)" />}
                <label style={{ position: 'absolute', bottom: '5px', right: '0px', backgroundColor: 'var(--brand-primary)', color: 'white', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: isUploadingLogo ? 'not-allowed' : 'pointer', border: '3px solid var(--surface-color)', boxShadow: '0 4px 10px rgba(0,0,0,0.15)' }}>
                  {isUploadingLogo ? <div style={{ width: '14px', height: '14px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> : <MdCameraAlt size={16} />}
                  <input type="file" accept="image/*" onChange={onLogoFileSelect} disabled={isUploadingLogo} style={{ display: 'none' }} />
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', overflowX: 'auto', scrollbarWidth: 'none', marginBottom: '20px', padding: '0 10px' }}>
              {['menu', 'staff', 'verification', 'reviews', 'preview'].map(tab => {
                const labels = { 
                  menu: <><MdDashboard size={18} /> Dashboard & Menu</>, 
                  staff: <><MdPeople size={18} /> Staff Access</>, 
                  verification: <><MdVerifiedUser size={18} /> Verification</>,
                  reviews: <><MdStar size={18} /> Reviews</>,
                  preview: <><MdSmartphone size={18} /> Live Preview</> 
                };
                const isActive = activeTab === tab;
                return (
                  <button 
                    key={tab} 
                    onClick={() => setActiveTab(tab)} 
                    style={{ 
                      padding: '10px 22px', 
                      borderRadius: '24px', 
                      backgroundColor: isActive ? 'var(--brand-primary)' : 'transparent', 
                      color: isActive ? 'white' : 'var(--text-muted)', 
                      border: 'none', 
                      fontWeight: '800', 
                      fontSize: '14px', 
                      cursor: 'pointer', 
                      whiteSpace: 'nowrap', 
                      transition: 'all 0.2s', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      boxShadow: isActive ? '0 4px 14px rgba(37,99,235,0.35)' : 'none'
                    }}
                  >
                    {labels[tab]}
                  </button>
                );
              })}
            </div>

            {/* --- TAB 1: MENU --- */}
            {activeTab === 'menu' && (
              <div>
                
                <div style={{ backgroundColor: 'var(--surface-color)', padding: '18px 24px', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: '0 4px 10px rgba(0,0,0,0.02)', marginBottom: '30px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Store Status</span>
                      <button 
                        onClick={toggleStoreStatus} 
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: activeStore.is_open ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-color)', padding: '8px 16px', borderRadius: '50px', border: activeStore.is_open ? '1px solid #10B981' : '1px solid var(--border-color)', cursor: 'pointer', transition: 'all 0.3s' }}
                      >
                        <span style={{ fontWeight: '900', fontSize: '12px', color: activeStore.is_open ? '#10B981' : 'var(--text-muted)' }}>OPEN</span>
                        <div style={{ width: '44px', height: '24px', backgroundColor: activeStore.is_open ? '#10B981' : 'var(--border-color)', borderRadius: '24px', position: 'relative', transition: 'all 0.3s' }}>
                          <div style={{ width: '18px', height: '18px', backgroundColor: 'white', borderRadius: '50%', position: 'absolute', top: '3px', left: activeStore.is_open ? '23px' : '3px', transition: 'left 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
                        </div>
                        <span style={{ fontWeight: '900', fontSize: '12px', color: !activeStore.is_open ? '#EF4444' : 'var(--text-muted)' }}>CLOSED</span>
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <button onClick={() => setIsQrModalOpen(true)} style={{ padding: '10px 16px', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><MdQrCode size={18} /> QR Code</button>
                      <button onClick={() => setIsScheduleModalOpen(true)} style={{ padding: '10px 16px', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><MdSchedule size={18} /> Operating Hours</button>
                      <button onClick={handleOpenEditModal} style={{ padding: '10px 16px', backgroundColor: 'var(--surface-hover)', color: 'var(--brand-primary)', border: '1px dashed var(--brand-primary)', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><MdEdit size={18} /> Edit Info</button>
                    </div>
                  </div>

                  {activeStore.merchant_id === user?.id && (
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <MdPalette size={18} color="var(--brand-primary)" />
                        <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main)' }}>Brand Theme Color:</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Choose an accent color for your storefront</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        {isSavingTheme && <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', fontWeight: 'bold', marginRight: '4px' }}>Saving...</span>}
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          {PRESET_COLORS.map(color => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => handleSelectColor(color)}
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                backgroundColor: color,
                                border: 'none',
                                boxShadow: storeTheme.primaryColor === color ? `0 0 0 2px var(--surface-color), 0 0 0 4px ${color}` : '0 2px 5px rgba(0,0,0,0.15)',
                                cursor: 'pointer',
                                outline: 'none',
                                transform: storeTheme.primaryColor === color ? 'scale(1.1)' : 'scale(1)',
                                transition: 'all 0.15s ease'
                              }}
                              title={`Select ${color}`}
                            />
                          ))}

                          <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-color)', margin: '0 4px' }} />

                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                            <input 
                              type="color" 
                              value={storeTheme.primaryColor} 
                              onChange={(e) => handleSelectColor(e.target.value)} 
                              style={{ width: '28px', height: '28px', padding: 0, border: 'none', borderRadius: '50%', cursor: 'pointer', background: 'none' }} 
                            />
                            Custom
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h2 style={{ margin: '0 0 0 0', fontSize: '20px', color: 'var(--text-main)', fontWeight: '800' }}>Manage Menu & Products</h2>
                      {isMenuLocked && (
                        <span style={{ padding: '4px 10px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MdLock size={12}/> LOCKED
                        </span>
                      )}
                    </div>
                    
                    <button 
                      onClick={isMenuLocked ? () => setIsUpgradeModalOpen(true) : openAddModal} 
                      style={{ 
                        padding: '10px 20px', 
                        backgroundColor: isMenuLocked ? '#F59E0B' : 'var(--brand-primary)', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '12px', 
                        fontWeight: 'bold', 
                        cursor: 'pointer', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px',
                        boxShadow: isMenuLocked ? '0 4px 10px rgba(245, 158, 11, 0.3)' : 'none',
                        transition: 'all 0.2s'
                      }}
                    >
                      {isMenuLocked ? <><MdLock size={18} /> Unlock Premium</> : <><MdAdd size={18} /> Add Item</>}
                    </button>
                  </div>

                  {categoryOrder.length > 0 && (
                    <div style={{ position: 'sticky', top: '70px', zIndex: 30, backgroundColor: 'var(--bg-color)', padding: '10px 0', margin: '0 -10px', paddingLeft: '10px', paddingRight: '10px' }}>
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToHorizontalAxis]}>
                        <div style={{ display: 'flex', gap: '10px', padding: '10px', overflowX: 'auto', backgroundColor: 'var(--surface-color)', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: '0 4px 10px rgba(0,0,0,0.05)', scrollbarWidth: 'none' }}>
                          <SortableContext items={categoryOrder} strategy={horizontalListSortingStrategy}>
                            {categoryOrder.map(cat => <SortableCategory key={cat} id={cat} activeCategory={activeCategory} brandColor={storeTheme.primaryColor} onClick={scrollToCategory} />)}
                          </SortableContext>
                        </div>
                      </DndContext>
                    </div>
                  )}

                  <div style={{ backgroundColor: 'var(--surface-color)', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {Object.keys(groupedItems).length === 0 ? (
                        <div style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', fontWeight: '500', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}><MdRestaurantMenu size={32} /> Your menu is currently empty.</div>
                      ) : (
                        categoryOrder.map(category => {
                          if (!groupedItems[category]) return null;
                          return (
                            <div key={category} ref={(el) => (sectionRefs.current[category] = el)}>
                              <div style={{ padding: '12px 30px', backgroundColor: 'var(--bg-color)', borderBottom: '1px solid var(--border-color)', borderTop: '1px solid var(--border-color)' }}><h3 style={{ margin: '0', fontSize: '13px', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase' }}>{category}</h3></div>
                              {groupedItems[category].map(item => (
                                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 30px', borderBottom: '1px solid var(--border-color)' }}>
                                  <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                                    {item.image_url ? <img src={item.image_url} alt={item.item_name} style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '10px' }} /> : <div style={{ width: '80px', height: '60px', backgroundColor: 'var(--surface-hover)', borderRadius: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--icon-color)' }}><MdRestaurantMenu size={24} /></div>}
                                    <div><h4 style={{ margin: '0 0 4px 0', fontSize: '16px', color: 'var(--text-main)', fontWeight: '800' }}>{item.item_name}</h4><p style={{ margin: '0', color: 'var(--text-muted)', fontSize: '13px', fontWeight: '500' }}>{item.description}</p></div>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)' }}>₱{parseFloat(item.price).toFixed(2)}</div>
                                    <div style={{ display: 'flex', gap: '5px', marginLeft: '10px' }}>
                                      <button 
                                        onClick={isMenuLocked ? () => setIsUpgradeModalOpen(true) : () => startEditItem(item)} 
                                        style={{ background: 'var(--surface-hover)', color: 'var(--brand-primary)', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}
                                      >
                                        {isMenuLocked ? <MdLock size={16} /> : <MdEdit size={16} />}
                                      </button>
                                      <button 
                                        onClick={isMenuLocked ? () => setIsUpgradeModalOpen(true) : () => handleDeleteItem(item.id, item.item_name)} 
                                        style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}
                                      >
                                        {isMenuLocked ? <MdLock size={16} /> : <MdDelete size={16} />}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- TAB 2: STAFF --- */}
            {activeTab === 'staff' && (
              <div style={{ backgroundColor: 'var(--surface-color)', padding: '30px', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
                <h3 style={{ margin: '0 0 10px 0', color: 'var(--text-main)', fontSize: '18px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}><MdSecurity color="var(--brand-primary)" /> Operator Access</h3>
                <p style={{ margin: '0 0 20px 0', color: 'var(--text-muted)', fontSize: '14px' }}>Invite trusted staff to manage inventory and open/close the store.</p>
                <form onSubmit={handleInviteOperator} style={{ display: 'flex', gap: '10px', marginBottom: '30px', maxWidth: '400px' }}>
                  <input type="email" placeholder="Staff Email Address" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} style={{ padding: '12px 15px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', flexGrow: 1, outline: 'none' }} />
                  <button type="submit" disabled={isInviting} style={{ padding: '12px 20px', backgroundColor: 'var(--brand-primary)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: isInviting ? 'not-allowed' : 'pointer' }}>{isInviting ? 'Sending...' : 'Invite'}</button>
                </form>
                {inviteMessage && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 'bold', padding: '12px', borderRadius: '10px', marginBottom: '20px', backgroundColor: inviteMessage.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: inviteMessage.type === 'success' ? '#10B981' : '#EF4444' }}>
                    {inviteMessage.type === 'success' ? <MdCheckCircle size={18} /> : <MdCancel size={18} />} {inviteMessage.text}
                  </div>
                )}
                
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '13px' }}>
                      <th style={{ padding: '12px 0' }}>User Email</th>
                      <th style={{ padding: '12px 0' }}>Status</th>
                      <th style={{ padding: '12px 0', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeStore.merchant_id === user?.id && (
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '16px 0', fontWeight: '600', color: 'var(--text-main)' }}>{user?.email}</td>
                        <td style={{ padding: '16px 0' }}>
                          <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '12px', backgroundColor: 'var(--surface-hover)', color: 'var(--brand-primary)', fontWeight: 'bold' }}>STORE OWNER</span>
                        </td>
                        <td style={{ padding: '16px 0', textAlign: 'right' }}></td>
                      </tr>
                    )}
                    {storeOperators.filter(op => op.user_id !== activeStore.merchant_id).map((op, idx) => (
                      <tr key={op.id || idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '16px 0', fontWeight: '600', color: 'var(--text-main)' }}>{op.email}</td>
                        <td style={{ padding: '16px 0' }}>
                          <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '12px', backgroundColor: op.status === 'pending' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: op.status === 'pending' ? '#D97706' : '#10B981', fontWeight: 'bold' }}>{op.status === 'pending' ? 'PENDING' : 'ACTIVE STAFF'}</span>
                        </td>
                        <td style={{ padding: '16px 0', textAlign: 'right' }}>
                          {activeStore.merchant_id === user?.id && op.status !== 'pending' && (
                             <button onClick={() => handleRemoveStaff(op.user_id, op.email)} style={{ padding: '6px 12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>Remove</button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {storeOperators.filter(op => op.user_id !== activeStore.merchant_id).length === 0 && activeStore.merchant_id === user?.id && (
                      <tr><td colSpan="3" style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>No staff members added yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* --- TAB 3: VERIFICATION --- */}
            {activeTab === 'verification' && (
              <VerificationPanel 
                store={activeStore} 
                userId={user?.id}
                onStoreUpdate={(updatedStore) => {
                  setActiveStore(updatedStore);
                  setStores(stores.map(s => s.id === updatedStore.id ? updatedStore : s));
                }}
              />
            )}

            {/* --- TAB 4: REVIEWS --- */}
            {activeTab === 'reviews' && (
              <div style={{ backgroundColor: 'var(--surface-color)', padding: '30px', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
                <h3 style={{ margin: '0 0 10px 0', color: 'var(--text-main)', fontSize: '18px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}><MdStar color="#F59E0B" /> Customer Reviews</h3>
                <p style={{ margin: '0 0 20px 0', color: 'var(--text-muted)', fontSize: '14px' }}>Read and respond to customer feedback to build trust and loyalty.</p>
                {loadingReviews ? (
                   <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading reviews...</div>
                ) : storeReviews.length === 0 ? (
                   <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>No reviews yet.</div>
                ) : (
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                     {storeReviews.map(review => (
                       <div key={review.id} style={{ padding: '20px', border: '1px solid var(--border-color)', borderRadius: '12px', backgroundColor: 'var(--bg-color)' }}>
                         <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                           <div>
                             <div style={{ fontWeight: '800', color: 'var(--text-main)', fontSize: '14px' }}>{review.reviewer_name}</div>
                             <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{new Date(review.created_at).toLocaleDateString()}</div>
                           </div>
                           <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '4px 8px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                             <span style={{ fontWeight: 'bold', color: '#F59E0B', fontSize: '13px' }}>{review.rating.toFixed(1)}</span>
                             <MdStar size={14} color="#F59E0B" />
                           </div>
                         </div>
                         <p style={{ margin: '0 0 15px 0', fontSize: '14px', color: 'var(--text-main)', lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                           {review.comment || <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>No written comment.</span>}
                         </p>
                         {review.photo_urls && review.photo_urls.length > 0 && (
                            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '15px' }}>
                              {review.photo_urls.map((url, i) => <img key={i} src={url} alt="Review" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border-color)' }} />)}
                            </div>
                         )}
                         {review.owner_reply ? (
                           <div style={{ backgroundColor: 'var(--surface-color)', padding: '15px', borderRadius: '8px', borderLeft: `4px solid ${storeTheme.primaryColor}` }}>
                             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '5px' }}>
                               <div style={{ fontSize: '12px', fontWeight: 'bold', color: storeTheme.primaryColor }}>Your Response:</div>
                               <div style={{ position: 'relative' }}>
                                 <button onClick={() => setActiveReviewMenuId(activeReviewMenuId === review.id ? null : review.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', color: 'var(--text-muted)' }}><MdMoreVert size={18} /></button>
                                 {activeReviewMenuId === review.id && (
                                   <>
                                     <div onClick={() => setActiveReviewMenuId(null)} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
                                     <div style={{ position: 'absolute', top: '100%', right: 0, backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 100, width: '120px', overflow: 'hidden' }}>
                                       <button onClick={() => handleDeleteReply(review.id)} style={{ width: '100%', padding: '10px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#DC2626' }}>Delete Reply</button>
                                     </div>
                                   </>
                                 )}
                               </div>
                             </div>
                             <div style={{ fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{review.owner_reply}</div>
                           </div>
                         ) : (
                           replyingToId === review.id ? (
                             <div style={{ marginTop: '10px' }}>
                               <textarea autoFocus maxLength={500} value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Write your response to the customer..." style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)', color: 'var(--text-main)', minHeight: '80px', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', wordBreak: 'break-word' }} />
                               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                                 <div style={{ fontSize: '12px', color: replyText.length >= 500 ? '#EF4444' : 'var(--text-muted)', fontWeight: 'bold' }}>{replyText.length} / 500 characters</div>
                                 <div style={{ display: 'flex', gap: '10px' }}>
                                   <button onClick={() => { setReplyingToId(null); setReplyText(''); }} style={{ padding: '8px 16px', background: 'none', border: 'none', color: 'var(--text-muted)', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
                                   <button onClick={() => submitReply(review.id)} disabled={isSubmittingReply || !replyText.trim()} style={{ padding: '8px 16px', backgroundColor: storeTheme.primaryColor, color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: isSubmittingReply || !replyText.trim() ? 'not-allowed' : 'pointer', fontSize: '13px', opacity: isSubmittingReply || !replyText.trim() ? 0.7 : 1 }}>{isSubmittingReply ? 'Posting...' : 'Post Reply'}</button>
                                 </div>
                               </div>
                             </div>
                           ) : (
                             <button onClick={() => { setReplyingToId(review.id); setReplyText(''); }} style={{ padding: '8px 16px', backgroundColor: 'var(--surface-color)', color: storeTheme.primaryColor, border: `1px solid ${storeTheme.primaryColor}`, borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}><MdReply size={16} /> Reply to Review</button>
                           )
                         )}
                       </div>
                     ))}
                   </div>
                )}
              </div>
            )}

            {/* --- TAB 5: PREVIEW --- */}
            {activeTab === 'preview' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px', backgroundColor: 'var(--surface-hover)', borderRadius: '24px', border: '1px dashed var(--border-color)' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', backgroundColor: 'var(--border-color)', padding: '6px', borderRadius: '12px' }}>
                  <button onClick={() => setIsPreviewMobile(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', border: 'none', transition: 'all 0.2s', backgroundColor: isPreviewMobile ? 'var(--surface-color)' : 'transparent', color: isPreviewMobile ? 'var(--text-main)' : 'var(--text-muted)', boxShadow: isPreviewMobile ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}><MdSmartphone size={18} /> Mobile</button>
                  <button onClick={() => setIsPreviewMobile(false)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', border: 'none', transition: 'all 0.2s', backgroundColor: !isPreviewMobile ? 'var(--surface-color)' : 'transparent', color: !isPreviewMobile ? 'var(--text-main)' : 'var(--text-muted)', boxShadow: !isPreviewMobile ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}><MdDesktopMac size={18} /> Desktop</button>
                </div>
                <div style={{ width: isPreviewMobile ? '375px' : '100%', height: isPreviewMobile ? '700px' : '800px', transition: 'width 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.1), height 0.4s ease', border: isPreviewMobile ? '12px solid #0F172A' : '1px solid var(--border-color)', borderRadius: isPreviewMobile ? '40px' : '16px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', backgroundColor: 'var(--surface-color)' }}>
                  <iframe src={`${window.location.origin}/store/${activeStore.id}`} style={{ width: '100%', height: '100%', border: 'none' }} title="Live Preview" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}