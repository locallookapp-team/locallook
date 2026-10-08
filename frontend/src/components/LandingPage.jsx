import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MdMap, 
  MdStorefront, 
  MdCancel,
  MdArrowForward,
  MdCheckCircle,
  MdLocationOn,
  MdRestaurantMenu
} from 'react-icons/md';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div style={{ height: '100vh', overflowY: 'auto', backgroundColor: '#F8FAFC' }}>
      
      <div style={{ fontFamily: 'Inter, sans-serif', color: '#0F172A', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        
        {/* --- NAVBAR --- */}
        <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 40px', backgroundColor: '#0F172A', color: 'white', borderBottom: '1px solid #1E293B', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '20px', fontWeight: '900', letterSpacing: '-0.5px' }}>
            <div style={{ width: '24px', height: '24px', backgroundColor: '#2563EB', borderRadius: '6px' }} />
            LocalLook
          </div>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <span onClick={() => navigate('/create-business')} style={{ color: '#94A3B8', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>For Businesses</span>
            <span onClick={() => navigate('/login')} style={{ color: '#94A3B8', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Log In</span>
            <button onClick={() => navigate('/map')} style={{ padding: '8px 16px', backgroundColor: '#2563EB', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}>Explore Map</button>
          </div>
        </nav>

        {/* --- 01. HERO SECTION --- */}
        <section style={{ backgroundColor: '#0F172A', padding: '80px 20px', display: 'flex', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ maxWidth: '1200px', width: '100%', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '50px' }}>
            
            <div style={{ flex: '1 1 500px', color: 'white' }}>
              <h1 style={{ fontSize: '56px', fontWeight: '900', margin: '0 0 20px 0', lineHeight: '1.1', letterSpacing: '-1px' }}>
                Know what's open.<br/>
                Know what's available.<br/>
                <span style={{ color: '#3B82F6' }}>Go where it matters.</span>
              </h1>
              <p style={{ fontSize: '18px', color: '#94A3B8', margin: '0 0 40px 0', lineHeight: '1.6', maxWidth: '480px' }}>
                Find local businesses, check what's available, browse digital menus, and see who's actually open right now near you — before you leave home.
              </p>
              <button onClick={() => navigate('/map')} style={{ padding: '16px 32px', backgroundColor: '#2563EB', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '800', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(37,99,235,0.3)', transition: 'transform 0.2s' }}>
                Explore LocalLook <MdArrowForward size={20} />
              </button>
            </div>

            {/* 🚀 UPGRADED: Hero Visual Map Mockup */}
            <div style={{ flex: '1 1 400px', display: 'flex', justifyContent: 'center', position: 'relative' }}>
              <div style={{ width: '100%', maxWidth: '500px', height: '350px', backgroundColor: '#1E293B', borderRadius: '24px', border: '1px solid #334155', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', position: 'relative', overflow: 'hidden', backgroundImage: 'radial-gradient(#334155 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
                
                {/* Search Bar */}
                <div style={{ position: 'absolute', top: '15px', left: '15px', right: '15px', padding: '12px 16px', backgroundColor: 'white', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                  <span style={{ color: '#94A3B8', fontSize: '16px' }}>🔍</span>
                  <span style={{ color: '#64748B', fontSize: '14px', fontWeight: '600' }}>Search nearby...</span>
                </div>

                {/* Legend */}
                <div style={{ position: 'absolute', bottom: '15px', right: '15px', padding: '10px 14px', backgroundColor: 'white', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: '700', color: '#0F172A' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '12px', height: '12px', backgroundColor: '#10B981', borderRadius: '50%' }} /> Open now</div>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '12px', height: '12px', backgroundColor: '#64748B', borderRadius: '50%' }} /> Closed</div>
                </div>

                {/* Glowing Open Pin (Cafe) */}
                <div style={{ position: 'absolute', top: '45%', left: '30%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ padding: '6px 12px', backgroundColor: 'white', color: '#0F172A', borderRadius: '8px', fontSize: '12px', fontWeight: '800', marginBottom: '8px', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>Coffee Corner</div>
                  <div style={{ width: '20px', height: '20px', backgroundColor: '#10B981', borderRadius: '50%', border: '3px solid white', boxShadow: '0 0 15px rgba(16, 185, 129, 0.6)' }} />
                </div>

                {/* Glowing Open Pin (Restaurant) */}
                <div style={{ position: 'absolute', top: '35%', left: '75%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ padding: '6px 12px', backgroundColor: 'white', color: '#0F172A', borderRadius: '8px', fontSize: '12px', fontWeight: '800', marginBottom: '8px', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>Burger Joint</div>
                  <div style={{ width: '20px', height: '20px', backgroundColor: '#10B981', borderRadius: '50%', border: '3px solid white', boxShadow: '0 0 15px rgba(16, 185, 129, 0.6)' }} />
                </div>

                {/* Closed Pin (Grocery) */}
                <div style={{ position: 'absolute', top: '65%', left: '70%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.7 }}>
                  <div style={{ padding: '4px 8px', backgroundColor: '#F1F5F9', color: '#64748B', borderRadius: '6px', fontSize: '10px', fontWeight: '700', marginBottom: '6px' }}>Grocery Store</div>
                  <div style={{ width: '16px', height: '16px', backgroundColor: '#64748B', borderRadius: '50%', border: '3px solid #94A3B8' }} />
                </div>

                {/* "You" Indicator */}
                <div style={{ position: 'absolute', top: '75%', left: '40%', transform: 'translate(-50%, -50%)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '16px', height: '16px', backgroundColor: '#3B82F6', borderRadius: '50%', border: '3px solid white', boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)' }} />
                  <span style={{ backgroundColor: 'white', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', color: '#0F172A', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>You</span>
                </div>

              </div>
            </div>

          </div>
        </section>

        {/* --- 02. THE PROBLEM --- */}
        <section style={{ padding: '80px 20px', backgroundColor: '#F8FAFC', display: 'flex', justifyContent: 'center', textAlign: 'center', flexShrink: 0 }}>
          <div style={{ maxWidth: '800px', width: '100%' }}>
            {/* 🚀 UPGRADED: Narrative Problem Statement */}
            <h2 style={{ fontSize: '36px', fontWeight: '900', color: '#0F172A', marginBottom: '15px' }}>You shouldn't have to guess before you go.</h2>
            <div style={{ fontSize: '18px', color: '#64748B', marginBottom: '10px', fontWeight: '500', lineHeight: '1.6' }}>
              You found the store.<br/>
              You checked the address.<br/>
              You went there.<br/>
              It was closed.
            </div>
            <div style={{ fontSize: '20px', color: '#2563EB', marginBottom: '50px', fontWeight: '800' }}>
              LocalLook changes that.
            </div>
            
            <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <MdCancel size={40} color="#EF4444" style={{ marginBottom: '15px' }} />
                <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '10px' }}>Closed Doors</h3>
              </div>
              <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <MdStorefront size={40} color="#F59E0B" style={{ marginBottom: '15px' }} />
                <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '10px' }}>Unavailable Products</h3>
              </div>
              <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <MdMap size={40} color="#64748B" style={{ marginBottom: '15px' }} />
                <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '10px' }}>Outdated Information</h3>
              </div>
            </div>
          </div>
        </section>

        {/* --- 03. THE SOLUTION --- */}
        <section style={{ padding: '80px 20px', backgroundColor: 'white', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          <div style={{ maxWidth: '1200px', width: '100%' }}>
            <div style={{ textAlign: 'center', marginBottom: '60px' }}>
              <h2 style={{ fontSize: '32px', fontWeight: '900', color: '#0F172A', marginBottom: '15px' }}>Local information, in real time.</h2>
              <p style={{ fontSize: '16px', color: '#64748B' }}>Don't just find businesses. Look inside.</p>
            </div>

            <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap', justifyContent: 'center' }}>
              
              <div style={{ flex: '1 1 300px', backgroundColor: '#F8FAFC', padding: '30px', borderRadius: '24px', border: '1px solid #E2E8F0' }}>
                <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>🟢 See who's open</h3>
                <p style={{ color: '#64748B', lineHeight: '1.5', marginBottom: '25px', fontSize: '15px' }}>Find businesses that are actually open and taking customers right now.</p>
                
                {/* 🚀 UPGRADED: Scaled UI Component Mockup */}
                <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 8px 20px rgba(0,0,0,0.04)' }}>
                  <div style={{ fontWeight: '900', color: '#0F172A', marginBottom: '12px', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    ☕ Café Example
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '10px', height: '10px', backgroundColor: '#10B981', borderRadius: '50%' }} />
                      <span style={{ fontSize: '14px', fontWeight: '800', color: '#10B981' }}>OPEN NOW</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748B', fontSize: '14px', fontWeight: '600' }}>
                      <MdLocationOn size={16} /> 120m away
                    </div>
                  </div>
                  <button style={{ width: '100%', padding: '12px', backgroundColor: '#F1F5F9', border: 'none', borderRadius: '8px', color: '#0F172A', fontWeight: '800', fontSize: '14px' }}>View Store →</button>
                </div>
              </div>

              <div style={{ flex: '1 1 300px', backgroundColor: '#F8FAFC', padding: '30px', borderRadius: '24px', border: '1px solid #E2E8F0' }}>
                <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>🍜 See what's available</h3>
                <p style={{ color: '#64748B', lineHeight: '1.5', marginBottom: '25px', fontSize: '15px' }}>Browse digital menus, products, and current availability before you go.</p>
                
                {/* 🚀 UPGRADED: Scaled UI Component Mockup */}
                <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 8px 20px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #F1F5F9', paddingBottom: '15px' }}>
                    <span style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>Iced Latte</span>
                    <span style={{ fontSize: '16px', fontWeight: '900', color: '#2563EB' }}>₱120</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '16px', fontWeight: '800', color: '#64748B', textDecoration: 'line-through' }}>Beef Burger</span>
                    <span style={{ fontSize: '12px', fontWeight: '900', color: '#EF4444', backgroundColor: '#FEF2F2', padding: '6px 10px', borderRadius: '8px' }}>SOLD OUT</span>
                  </div>
                </div>
              </div>

              <div style={{ flex: '1 1 300px', backgroundColor: '#F8FAFC', padding: '30px', borderRadius: '24px', border: '1px solid #E2E8F0' }}>
                <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>📍 Go with confidence</h3>
                <p style={{ color: '#64748B', lineHeight: '1.5', marginBottom: '25px', fontSize: '15px' }}>Know exactly where you're going and what you'll find when you get there.</p>
                
                {/* 🚀 UPGRADED: Scaled UI Component Mockup */}
                <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 8px 20px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ width: '48px', height: '48px', backgroundColor: '#EFF6FF', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}><MdLocationOn color="#2563EB" size={24} /></div>
                  <div>
                    <div style={{ fontWeight: '900', fontSize: '16px', color: '#0F172A', marginBottom: '4px' }}>Directions Ready</div>
                    <div style={{ fontSize: '14px', color: '#64748B', fontWeight: '500' }}>Tap pin to navigate</div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* --- 04. THE DIFFERENTIATOR --- */}
        <section style={{ padding: '80px 20px', backgroundColor: '#0F172A', color: 'white', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          <div style={{ maxWidth: '800px', width: '100%', textAlign: 'center' }}>
            {/* 🚀 UPGRADED: Refined Differentiator Copy */}
            <h2 style={{ fontSize: '36px', fontWeight: '900', marginBottom: '15px', lineHeight: '1.2' }}>Maps tell you <span style={{ color: '#94A3B8' }}>where.</span><br/>LocalLook tells you <span style={{ color: '#3B82F6' }}>what's happening.</span></h2>
            <p style={{ fontSize: '16px', color: '#94A3B8', marginBottom: '50px' }}>We don't just list businesses. We connect you to their pulse.</p>
            
            <div style={{ backgroundColor: '#1E293B', borderRadius: '20px', overflow: 'hidden', border: '1px solid #334155' }}>
              <div style={{ display: 'flex', borderBottom: '1px solid #334155', backgroundColor: '#0F172A' }}>
                <div style={{ flex: 1, padding: '20px', fontWeight: '800', color: '#94A3B8' }}>Traditional Maps</div>
                <div style={{ flex: 1, padding: '20px', fontWeight: '900', color: '#3B82F6', borderLeft: '1px solid #334155' }}>LocalLook</div>
              </div>
              <div style={{ display: 'flex', borderBottom: '1px solid #334155' }}>
                <div style={{ flex: 1, padding: '15px 20px', color: '#94A3B8', fontSize: '14px' }}>Business location</div>
                <div style={{ flex: 1, padding: '15px 20px', color: 'white', fontSize: '14px', borderLeft: '1px solid #334155' }}>Business location</div>
              </div>
              <div style={{ display: 'flex', borderBottom: '1px solid #334155' }}>
                <div style={{ flex: 1, padding: '15px 20px', color: '#94A3B8', fontSize: '14px' }}>Static opening hours</div>
                <div style={{ flex: 1, padding: '15px 20px', color: '#10B981', fontWeight: '800', fontSize: '14px', borderLeft: '1px solid #334155' }}>Live Open/Closed status</div>
              </div>
              <div style={{ display: 'flex', borderBottom: '1px solid #334155' }}>
                <div style={{ flex: 1, padding: '15px 20px', color: '#94A3B8', fontSize: '14px' }}>Generic listing</div>
                <div style={{ flex: 1, padding: '15px 20px', color: 'white', fontWeight: '800', fontSize: '14px', borderLeft: '1px solid #334155' }}>Digital storefront & menu</div>
              </div>
              <div style={{ display: 'flex' }}>
                <div style={{ flex: 1, padding: '15px 20px', color: '#94A3B8', fontSize: '14px' }}>Static business information</div>
                <div style={{ flex: 1, padding: '15px 20px', color: 'white', fontWeight: '800', fontSize: '14px', borderLeft: '1px solid #334155' }}>Live business information</div>
              </div>
            </div>
          </div>
        </section>

        {/* --- 05. FOR BUSINESSES --- */}
        <section style={{ padding: '80px 20px', backgroundColor: 'white', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          <div style={{ maxWidth: '1100px', display: 'flex', gap: '60px', flexWrap: 'wrap', alignItems: 'center' }}>
            
            <div style={{ flex: '1 1 400px' }}>
              <div style={{ padding: '6px 12px', backgroundColor: '#EFF6FF', color: '#2563EB', fontWeight: '800', fontSize: '12px', borderRadius: '20px', display: 'inline-block', marginBottom: '15px' }}>FOR LOCAL BUSINESSES</div>
              <h2 style={{ fontSize: '36px', fontWeight: '900', marginBottom: '20px', lineHeight: '1.2' }}>Turn foot traffic into <span style={{ color: '#2563EB' }}>your traffic.</span></h2>
              <p style={{ color: '#64748B', fontSize: '16px', lineHeight: '1.6', marginBottom: '30px' }}>
                Claim your spot on the map and attract walking customers looking for exactly what you sell. 
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><MdCheckCircle color="#10B981" size={20} /> <span style={{ fontWeight: '600', color: '#334155' }}>One-tap "Open/Close" live status</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><MdCheckCircle color="#10B981" size={20} /> <span style={{ fontWeight: '600', color: '#334155' }}>Drag-and-drop digital menu builder</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><MdCheckCircle color="#10B981" size={20} /> <span style={{ fontWeight: '600', color: '#334155' }}>Instant "Out of Stock" inventory toggles</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><MdCheckCircle color="#10B981" size={20} /> <span style={{ fontWeight: '600', color: '#334155' }}>Automated weekly scheduling</span></div>
              </div>

              <button onClick={() => navigate('/create-business')} style={{ marginTop: '40px', padding: '14px 28px', backgroundColor: '#0F172A', color: 'white', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '800', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                List Your Business <MdArrowForward size={18} />
              </button>
            </div>

            {/* Advanced Storefront Mockup Graphic */}
            <div style={{ flex: '1 1 400px', display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: '100%', maxWidth: '340px', backgroundColor: 'white', borderRadius: '30px', border: '8px solid #0F172A', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
                {/* Mockup Header */}
                <div style={{ height: '150px', backgroundColor: '#E2E8F0', position: 'relative', display: 'flex', alignItems: 'flex-end', padding: '20px' }}>
                  <div style={{ position: 'absolute', top: '15px', right: '15px', padding: '6px 12px', backgroundColor: '#10B981', color: 'white', borderRadius: '20px', fontSize: '10px', fontWeight: '900', boxShadow: '0 4px 10px rgba(16, 185, 129, 0.4)' }}>OPEN NOW</div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '24px', fontWeight: '900', color: '#0F172A', marginBottom: '4px' }}>Café Example</h3>
                    {/* 🚀 UPGRADED: Added Location to Merchant Mockup */}
                    <div style={{ fontSize: '12px', color: '#475569', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MdLocationOn size={14} /> Odiongan • 120m away
                    </div>
                  </div>
                </div>
                
                {/* Mockup Menu */}
                <div style={{ padding: '20px', backgroundColor: '#F8FAFC' }}>
                  <div style={{ fontSize: '12px', fontWeight: '800', color: '#64748B', marginBottom: '15px', textTransform: 'uppercase' }}>BEST SELLERS</div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: '15px', borderRadius: '12px', marginBottom: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <div style={{ width: '40px', height: '40px', backgroundColor: '#EFF6FF', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}><MdRestaurantMenu color="#2563EB" /></div>
                      <span style={{ fontWeight: '700', fontSize: '14px', color: '#0F172A' }}>Iced Latte</span>
                    </div>
                    <span style={{ fontWeight: '900', color: '#0F172A' }}>₱120</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: '15px', borderRadius: '12px', marginBottom: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <div style={{ width: '40px', height: '40px', backgroundColor: '#EFF6FF', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}><MdRestaurantMenu color="#2563EB" /></div>
                      <span style={{ fontWeight: '700', fontSize: '14px', color: '#0F172A' }}>Cheesecake</span>
                    </div>
                    <span style={{ fontWeight: '900', color: '#0F172A' }}>₱150</span>
                  </div>

                  <button style={{ width: '100%', padding: '12px', backgroundColor: '#2563EB', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '800', fontSize: '14px', marginTop: '10px' }}>View Full Store</button>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* --- 06. FINAL CTA & FOOTER --- */}
        <section style={{ backgroundColor: '#F8FAFC', padding: '80px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
          <h2 style={{ fontSize: '36px', fontWeight: '900', color: '#0F172A', marginBottom: '15px' }}>Stop wondering what's open.<br/><span style={{ color: '#2563EB' }}>Start knowing what's nearby.</span></h2>
          <button onClick={() => navigate('/map')} style={{ marginTop: '30px', padding: '16px 36px', backgroundColor: '#2563EB', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '800', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(37,99,235,0.3)' }}>
            Explore LocalLook <MdArrowForward size={20} />
          </button>
        </section>

        <footer style={{ backgroundColor: '#0F172A', color: '#94A3B8', padding: '40px 20px', textAlign: 'center', marginTop: 'auto', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', fontSize: '13px', marginBottom: '20px' }}>
            <span onClick={() => navigate('/privacy')} style={{ cursor: 'pointer', transition: 'color 0.2s' }} onMouseOver={(e) => e.target.style.color='white'} onMouseOut={(e) => e.target.style.color='#94A3B8'}>Privacy Policy</span>
            <span onClick={() => navigate('/terms')} style={{ cursor: 'pointer', transition: 'color 0.2s' }} onMouseOver={(e) => e.target.style.color='white'} onMouseOut={(e) => e.target.style.color='#94A3B8'}>Terms of Service</span>
            <span style={{ cursor: 'pointer', transition: 'color 0.2s' }} onMouseOver={(e) => e.target.style.color='white'} onMouseOut={(e) => e.target.style.color='#94A3B8'}>Contact Us</span>
          </div>
          <div style={{ fontSize: '12px', opacity: 0.6 }}>© {new Date().getFullYear()} LocalLook. All rights reserved.</div>
        </footer>

      </div>
    </div>
  );
}