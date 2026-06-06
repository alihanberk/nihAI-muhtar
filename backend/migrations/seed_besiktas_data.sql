-- Seed data for Beşiktaş Merkez district
-- This adds sample facade analysis data for testing

-- Create a job for Beşiktaş Merkez
INSERT INTO facade_analysis_jobs (id, district, center_lat, center_lng, radius_m, status, total_count, done_count, created_at, updated_at)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'Beşiktaş Merkez', 41.0425, 29.0085, 500, 'completed', 5, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- Insert sample buildings with varying risk levels
INSERT INTO facade_buildings (id, job_id, district, address, lat, lng, heading, street_view_url, health_score, risk_level, defect_count, needs_human_review, analysis_year, created_at, updated_at)
VALUES 
    -- EMERGENCY risk building
    ('22222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111111', 'Beşiktaş Merkez', 'Barbaros Bulvarı No:123', 41.0425, 29.0085, 0, 'https://maps.googleapis.com/maps/api/streetview?size=640x480&location=41.0425,29.0085&heading=0', 25.5, 'EMERGENCY', 5, true, 2026, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    
    -- RISKY building
    ('22222222-2222-2222-2222-222222222223', '11111111-1111-1111-1111-111111111111', 'Beşiktaş Merkez', 'Beşiktaş Meydanı No:78', 41.0420, 29.0080, 180, 'https://maps.googleapis.com/maps/api/streetview?size=640x480&location=41.0420,29.0080&heading=180', 45.8, 'RISKY', 3, false, 2026, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    
    -- ATTENTION building
    ('22222222-2222-2222-2222-222222222225', '11111111-1111-1111-1111-111111111111', 'Beşiktaş Merkez', 'Sinanpaşa Mahallesi No:89', 41.0415, 29.0075, 45, 'https://maps.googleapis.com/maps/api/streetview?size=640x480&location=41.0415,29.0075&heading=45', 68.7, 'ATTENTION', 2, false, 2026, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    
    -- HEALTHY buildings
    ('22222222-2222-2222-2222-222222222227', '11111111-1111-1111-1111-111111111111', 'Beşiktaş Merkez', 'Ortabahçe Caddesi No:67', 41.0410, 29.0070, 225, 'https://maps.googleapis.com/maps/api/streetview?size=640x480&location=41.0410,29.0070&heading=225', 85.6, 'HEALTHY', 0, false, 2026, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-222222222228', '11111111-1111-1111-1111-111111111111', 'Beşiktaş Merkez', 'Yıldız Posta Caddesi No:23', 41.0445, 29.0105, 315, 'https://maps.googleapis.com/maps/api/streetview?size=640x480&location=41.0445,29.0105&heading=315', 88.9, 'HEALTHY', 0, false, 2026, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- Insert defects for buildings
INSERT INTO facade_defects (building_id, defect_type, severity, confidence, uncertain, bbox_xmin, bbox_ymin, bbox_xmax, bbox_ymax, label, created_at)
VALUES 
    -- Building 1 - EMERGENCY
    ('22222222-2222-2222-2222-222222222221', 'structural_crack', 5, 0.92, false, 100, 150, 250, 350, 'Büyük yapısal çatlak tespit edildi', CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-222222222221', 'spalling', 4, 0.88, false, 300, 200, 450, 400, 'Beton dökülmesi mevcut', CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-222222222221', 'corrosion_stain', 3, 0.85, false, 50, 100, 200, 250, 'Korozyon lekesi görülüyor', CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-222222222221', 'deformed_balcony', 5, 0.95, false, 150, 250, 400, 450, 'Balkon deformasyonu kritik seviyede', CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-222222222221', 'building_tilt', 4, 0.78, false, 0, 0, 640, 480, 'Bina eğikliği tespit edildi', CURRENT_TIMESTAMP),
    
    -- Building 3 - RISKY
    ('22222222-2222-2222-2222-222222222223', 'structural_crack', 3, 0.83, false, 150, 200, 300, 400, 'Orta seviye çatlak', CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-222222222223', 'corrosion_stain', 3, 0.81, false, 350, 150, 500, 350, 'Korozyon başlangıcı', CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-222222222223', 'spalling', 2, 0.75, false, 100, 300, 250, 450, 'Hafif beton dökülmesi', CURRENT_TIMESTAMP),
    
    -- Building 5 - ATTENTION
    ('22222222-2222-2222-2222-222222222225', 'corrosion_stain', 2, 0.76, false, 180, 220, 320, 380, 'Küçük korozyon', CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-222222222225', 'structural_crack', 1, 0.68, true, 250, 150, 400, 300, 'İnce çatlak - incelenmeli', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- Insert some citizen reports
INSERT INTO facade_citizen_reports (building_id, lat, lng, description, photo_url, status, created_at)
VALUES 
    ('22222222-2222-2222-2222-222222222221', 41.0425, 29.0085, 'Balkonda ciddi çatlaklar var, tehlikeli görünüyor', '', 'pending', CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-222222222223', 41.0420, 29.0080, 'Duvarda uzun çatlak görülüyor', '', 'pending', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;
