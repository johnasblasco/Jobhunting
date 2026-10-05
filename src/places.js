// Place names used to tell whether a job is really in your country.
// A job whose location mentions none of these is dropped (when onlyCountry is on).
export const PLACES = {
  ph: [
    'philippines', 'pilipinas', 'ph', 'phl', 'metro manila', 'ncr', 'manila', 'makati', 'taguig', 'bgc',
    'bonifacio global city', 'pasig', 'ortigas', 'quezon city', 'mandaluyong', 'pasay', 'paranaque',
    'las pinas', 'muntinlupa', 'alabang', 'caloocan', 'valenzuela', 'marikina', 'malabon', 'navotas', 'pateros',
    'cebu', 'mandaue', 'lapu lapu', 'davao', 'iloilo', 'bacolod', 'cagayan de oro', 'baguio', 'pampanga',
    'angeles city', 'clark freeport', 'laguna', 'calamba', 'binan', 'cabuyao', 'san pedro laguna', 'cavite', 'imus',
    'bacoor', 'dasmarinas', 'general trias', 'batangas', 'lipa', 'bulacan', 'malolos', 'meycauayan', 'rizal',
    'antipolo', 'cainta', 'taytay', 'zamboanga', 'general santos', 'tacloban', 'dumaguete', 'legazpi', 'iligan',
    'butuan', 'puerto princesa', 'tarlac', 'dagupan', 'cabanatuan', 'olongapo', 'subic', 'nueva ecija',
    'pangasinan', 'ilocos', 'laoag', 'vigan', 'tuguegarao', 'naga city', 'camarines', 'albay', 'bohol', 'tagbilaran',
    'leyte', 'samar', 'negros', 'panay', 'mindanao', 'visayas', 'luzon', 'palawan', 'cotabato', 'koronadal',
  ],
};

// Locations mentioning these are definitely abroad, even if a city name looks Filipino
// (e.g. "Laguna Hills, CA, United States").
export const ABROAD = [
  'united states', 'usa', 'us', 'canada', 'united kingdom', 'uk', 'australia', 'new zealand', 'india', 'singapore',
  'malaysia', 'indonesia', 'vietnam', 'thailand', 'japan', 'china', 'hong kong', 'germany', 'france', 'spain',
  'netherlands', 'ireland', 'mexico', 'brazil', 'united arab emirates', 'uae', 'saudi arabia', 'qatar',
];
