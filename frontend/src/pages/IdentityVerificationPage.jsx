import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { MdUploadFile, MdCheckCircle, MdPendingActions, MdWarning, MdStorefront } from 'react-icons/md';

export default function IdentityVerificationPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  // KYC State
  const [kycProfile, setKycProfile] = useState(null);
  const [rejectionMessage, setRejectionMessage] = useState(null);
  
  const [formData, setFormData] = useState({
    full_legal_name: '',
    phone_number: '',
    home_address: '',
    idFile: null
  });

  useEffect(() => {
    const fetchUserAndKyc = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
        return;
      }
      setUser(session.user);

      // Check if they already submitted their identity
      const { data, error } = await supabase
        .from('merchant_profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (data) {
        setKycProfile(data);
        
        // Fetch the exact rejection message securely from notifications if rejected
        if (data.kyc_status === 'rejected') {
          const { data: noteData } = await supabase
            .from('notifications')
            .select('message')
            .eq('user_id', session.user.id)
            .eq('title', 'Verification Failed')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
            
          if (noteData) {
            // Extracts only the custom reason, removing the boilerplate text added in the backend
            const cleanMessage = noteData.message.replace('Your verification was rejected: ', '').replace('\n\nPlease resubmit your documents.', '');
            setRejectionMessage(cleanMessage);
          }
        }
      }
      setLoading(false);
    };

    fetchUserAndKyc();
  }, [navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFormData(prev => ({ ...prev, idFile: e.target.files[0] }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.idFile) return alert("Please upload a valid Government ID.");
    
    setUploading(true);

    try {
      const folderPath = `${user.id}`;
      
      // 🧹 THE FIX: Folder Sweeping!
      // List all existing files in the user's KYC folder and scrub them clean before uploading
      const { data: existingStorageFiles } = await supabase.storage
        .from('kyc-documents')
        .list(folderPath);

      if (existingStorageFiles && existingStorageFiles.length > 0) {
        const filesToDelete = existingStorageFiles
          .filter(file => file.name !== '.emptyFolderPlaceholder')
          .map(file => `${folderPath}/${file.name}`);

        if (filesToDelete.length > 0) {
          await supabase.storage.from('kyc-documents').remove(filesToDelete);
        }
      }

      // 1. Upload new ID to the secure kyc-documents bucket
      const fileExt = formData.idFile.name.split('.').pop();
      const fileName = `${folderPath}/gov-id-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('kyc-documents')
        .upload(fileName, formData.idFile);

      if (uploadError) throw uploadError;

      // 2. Save the profile to the database
      const profileData = {
        id: user.id,
        full_legal_name: formData.full_legal_name,
        phone_number: formData.phone_number,
        home_address: formData.home_address,
        gov_id_url: fileName, // Store the secure path, not a public URL
        kyc_status: 'pending'
      };

      // Upsert handles both new submissions and re-submissions if previously rejected
      const { error: dbError } = await supabase
        .from('merchant_profiles')
        .upsert([profileData]);

      if (dbError) throw dbError;

      // Update local state to show pending screen
      setKycProfile({ ...profileData, kyc_status: 'pending' });

    } catch (error) {
      console.error("Verification error:", error);
      alert("Failed to submit verification: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>Loading securely...</div>;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFC', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
      
      <div style={{ width: '100%', maxWidth: '600px', backgroundColor: '#FFFFFF', borderRadius: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ backgroundColor: '#0F172A', padding: '30px', textAlign: 'center' }}>
          <div style={{ width: '60px', height: '60px', backgroundColor: '#2563EB', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0 auto 15px auto', color: 'white' }}>
            <MdStorefront size={30} />
          </div>
          <h1 style={{ color: 'white', margin: 0, fontSize: '24px', fontWeight: '800' }}>Merchant Verification</h1>
          <p style={{ color: '#94A3B8', margin: '10px 0 0 0', fontSize: '14px' }}>To keep our community safe, we need to verify your identity before you can add a store.</p>
        </div>

        <div style={{ padding: '30px' }}>
          
          {/* STATE 1: PENDING */}
          {kycProfile?.kyc_status === 'pending' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <MdPendingActions size={60} color="#F59E0B" style={{ marginBottom: '15px' }} />
              <h2 style={{ color: '#0F172A', fontSize: '20px', fontWeight: '800', margin: '0 0 10px 0' }}>Verification in Progress</h2>
              <p style={{ color: '#64748B', fontSize: '14px', lineHeight: '1.6' }}>
                Your identity documents have been securely submitted. Our team is currently reviewing your profile. This usually takes 1-2 business days.
              </p>
              <button onClick={() => navigate('/')} style={{ marginTop: '20px', padding: '12px 24px', backgroundColor: '#F1F5F9', color: '#475569', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                Return Home
              </button>
            </div>
          )}

          {/* STATE 2: APPROVED */}
          {kycProfile?.kyc_status === 'approved' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <MdCheckCircle size={60} color="#10B981" style={{ marginBottom: '15px' }} />
              <h2 style={{ color: '#0F172A', fontSize: '20px', fontWeight: '800', margin: '0 0 10px 0' }}>Identity Verified!</h2>
              <p style={{ color: '#64748B', fontSize: '14px', lineHeight: '1.6' }}>
                Thank you for verifying your identity. You now have full access to create and manage local businesses on the platform.
              </p>
              <button onClick={() => navigate('/create-business')} style={{ marginTop: '20px', padding: '14px 28px', backgroundColor: '#2563EB', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '800', fontSize: '15px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(37, 99, 235, 0.2)' }}>
                Create Your First Store
              </button>
            </div>
          )}

          {/* STATE 3: FORM (Null or Rejected) */}
          {(!kycProfile || kycProfile.kyc_status === 'rejected') && (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {kycProfile?.kyc_status === 'rejected' && (
                <div style={{ padding: '15px', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '12px', display: 'flex', gap: '10px' }}>
                  <MdWarning size={24} color="#DC2626" style={{ flexShrink: 0 }} />
                  <div>
                    <h3 style={{ margin: '0 0 5px 0', color: '#991B1B', fontSize: '14px', fontWeight: '800' }}>Verification Failed</h3>
                    <p style={{ margin: 0, color: '#DC2626', fontSize: '13px' }}>Reason: {rejectionMessage || "Document unreadable or invalid."} Please update your information and try again.</p>
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '800', color: '#475569', marginBottom: '8px' }}>Full Legal Name</label>
                <input type="text" name="full_legal_name" required placeholder="Juan Dela Cruz" value={formData.full_legal_name} onChange={handleInputChange} style={{ width: '100%', padding: '14px', border: '1px solid #E2E8F0', borderRadius: '12px', boxSizing: 'border-box', fontSize: '14px', backgroundColor: '#F8FAFC' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '800', color: '#475569', marginBottom: '8px' }}>Phone Number</label>
                <input type="tel" name="phone_number" required placeholder="09123456789" value={formData.phone_number} onChange={handleInputChange} style={{ width: '100%', padding: '14px', border: '1px solid #E2E8F0', borderRadius: '12px', boxSizing: 'border-box', fontSize: '14px', backgroundColor: '#F8FAFC' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '800', color: '#475569', marginBottom: '8px' }}>Home Address</label>
                <textarea name="home_address" required placeholder="House No., Street, Barangay, Municipality" value={formData.home_address} onChange={handleInputChange} style={{ width: '100%', padding: '14px', border: '1px solid #E2E8F0', borderRadius: '12px', boxSizing: 'border-box', minHeight: '80px', fontSize: '14px', backgroundColor: '#F8FAFC', fontFamily: 'inherit' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '800', color: '#475569', marginBottom: '8px' }}>Valid Government ID</label>
                <div style={{ border: '2px dashed #CBD5E1', padding: '24px', borderRadius: '12px', textAlign: 'center', backgroundColor: '#F8FAFC', transition: 'all 0.2s' }}>
                  <label style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <MdUploadFile size={32} color={formData.idFile ? '#10B981' : '#2563EB'} />
                    <span style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>
                      {formData.idFile ? formData.idFile.name : 'Tap to Upload ID Photo'}
                    </span>
                    <span style={{ fontSize: '12px', color: '#64748B' }}>Driver's License, Passport, PhilID, or Postal ID</span>
                    <input type="file" accept="image/*,.pdf" onChange={handleFileChange} disabled={uploading} style={{ display: 'none' }} />
                  </label>
                </div>
              </div>

              <button type="submit" disabled={uploading} style={{ marginTop: '10px', padding: '16px', backgroundColor: '#2563EB', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '800', fontSize: '15px', cursor: uploading ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.2)' }}>
                {uploading ? 'Securely Uploading...' : 'Submit Identity for Verification'}
              </button>

            </form>
          )}

        </div>
      </div>
      
      <p style={{ marginTop: '20px', color: '#94A3B8', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
        <MdStorefront /> LocalLook strictly protects your personal data.
      </p>
    </div>
  );
}