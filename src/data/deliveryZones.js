export const DELIVERY_ZONES = {
  WESTCHESTER: {
    name: 'Westchester County',
    deliveryFee: 28.00,
    zipCodes: [
      '10501', '10502', '10503', '10504', '10505', '10506', '10507', '10510', '10511', '10514', 
      '10517', '10518', '10519', '10520', '10521', '10522', '10523', '10526', '10527', '10528', 
      '10530', '10532', '10533', '10535', '10536', '10537', '10538', '10540', '10543', '10545', 
      '10546', '10547', '10548', '10549', '10550', '10551', '10552', '10553', '10557', '10558', 
      '10560', '10562', '10566', '10567', '10570', '10571', '10572', '10573', '10576', '10577', 
      '10578', '10580', '10583', '10587', '10588', '10589', '10590', '10591', '10594', '10595', 
      '10596', '10597', '10598', '10601', '10602', '10603', '10604', '10605', '10606', '10607', 
      '10610', '10701', '10702', '10703', '10704', '10705', '10706', '10707', '10708', '10709', 
      '10710', '10801', '10802', '10803', '10804', '10805'
    ]
  },
  
  NEW_YORK: {
    name: 'New York County',
    deliveryFee: 28.00,
    zipCodes: [
      '10001', '10002', '10003', '10004', '10005', '10006', '10007', '10008', '10009', '10010', 
      '10011', '10012', '10013', '10014', '10015', '10016', '10017', '10018', '10019', '10020', 
      '10021', '10022', '10023', '10024', '10025', '10026', '10027', '10028', '10029', '10030', 
      '10031', '10032', '10033', '10034', '10035', '10036', '10037', '10038', '10039', '10040', 
      '10041', '10043', '10044', '10045', '10046', '10047', '10048', '10055', '10060', '10065', 
      '10069', '10072', '10075', '10079', '10080', '10081', '10082', '10087', '10090', '10094', 
      '10095', '10096', '10098', '10099', '10101', '10102', '10103', '10104', '10105', '10106', 
      '10107', '10108', '10109', '10110', '10111', '10112', '10113', '10114', '10115', '10116', 
      '10117', '10118', '10119', '10120', '10121', '10122', '10123', '10124', '10125', '10126', 
      '10128', '10129', '10130', '10131', '10132', '10133', '10138', '10149', '10150', '10151', 
      '10152', '10153', '10154', '10155', '10156', '10157', '10158', '10159', '10160', '10161', 
      '10162', '10163', '10164', '10165', '10166', '10167', '10168', '10169', '10170', '10171', 
      '10172', '10173', '10174', '10175', '10176', '10177', '10178', '10179', '10184', '10185', 
      '10196', '10197', '10199', '10203', '10211', '10212', '10213', '10242', '10249', '10256', 
      '10257', '10258', '10259', '10260', '10261', '10265', '10268', '10269', '10270', '10271', 
      '10272', '10273', '10274', '10275', '10276', '10277', '10278', '10279', '10280', '10281', 
      '10282', '10285', '10286', '10292', '10451', '10454', '11109'
    ]
  },
  
  BRONX: {
    name: 'Bronx County',
    deliveryFee: 26.00,
    zipCodes: [
      '10451', '10452', '10453', '10454', '10455', '10456', '10457', '10458', '10459', '10460', 
      '10461', '10462', '10463', '10464', '10465', '10466', '10467', '10468', '10469', '10470', 
      '10471', '10472', '10473', '10474', '10475', '10499', '10803'
    ]
  },
  
  KINGS: {
    name: 'Kings County',
    deliveryFee: 30.00,
    zipCodes: [
      '11201', '11202', '11203', '11204', '11205', '11206', '11207', '11208', '11209', '11210', 
      '11211', '11212', '11213', '11214', '11215', '11216', '11217', '11218', '11219', '11220', 
      '11221', '11222', '11223', '11224', '11225', '11226', '11228', '11229', '11230', '11231', 
      '11232', '11233', '11234', '11235', '11236', '11237', '11238', '11239', '11240', '11241', 
      '11242', '11243', '11244', '11245', '11247', '11248', '11249', '11251', '11252', '11254', 
      '11255', '11256'
    ]
  },
  
  QUEENS: {
    name: 'Queens County',
    deliveryFee: 20.00,
    zipCodes: [
      '11001', '11004', '11005', '11096', '11101', '11102', '11103', '11104', '11105', '11106', 
      '11109', '11120', '11351', '11352', '11354', '11355', '11356', '11357', '11358', '11359', 
      '11360', '11361', '11362', '11363', '11364', '11365', '11366', '11367', '11368', '11369', 
      '11370', '11371', '11372', '11373', '11374', '11375', '11377', '11378', '11379', '11380', 
      '11381', '11385', '11386', '11390', '11405', '11411', '11412', '11413', '11414', '11415', 
      '11416', '11417', '11418', '11419', '11420', '11421', '11422', '11423', '11424', '11425', 
      '11426', '11427', '11428', '11429', '11430', '11431', '11432', '11433', '11434', '11435', 
      '11436', '11437', '11439', '11451', '11499', '11690', '11691', '11692', '11693', '11694', 
      '11695', '11697'
    ]
  },
  
  FIVE_TOWNS: {
    name: '5Towns',
    deliveryFee: 5.00,
    zipCodes: [
      '11096', '11422', '11516', '11557', '11559', '11563', '11581', '11598'
    ]
  },
  
  GREAT_NECK: {
    name: 'Great Neck',
    deliveryFee: 16.00,
    zipCodes: [
      '11020', '11021', '11022', '11023', '11024'
    ]
  },
  
  NASSAU: {
    name: 'Nassau County',
    deliveryFee: 16.00,
    zipCodes: [
      '11001', '11002', '11003', '11005', '11010', 
      '11025', '11026', '11027', '11030', '11040', '11041', '11042', '11043', '11044', '11050', 
      '11051', '11052', '11053', '11054', '11055', '11096', '11099', '11501', '11507', '11509', 
      '11510', '11514', '11516', '11518', '11520', '11530', '11531', '11535', '11536', '11542', 
      '11545', '11547', '11548', '11549', '11550', '11551', '11552', '11553', '11554', '11555', 
      '11556', '11557', '11558', '11559', '11560', '11561', '11563', '11565', '11566', '11568', 
      '11569', '11570', '11571', '11572', '11575', '11576', '11577', '11579', '11580', '11581', 
      '11582', '11590', '11592', '11594', '11595', '11596', '11597', '11598', '11599', '11702', 
      '11709', '11710', '11714', '11724', '11732', '11735', '11736', '11753', '11756', '11758', 
      '11762', '11765', '11771', '11773', '11774', '11783', '11791', '11793', '11797', '11801', 
      '11802', '11803', '11804', '11815', '11819', '11853', '11854', '11855'
    ]
  },
  
  HAMPTONS: {
    name: 'The Hamptons',
    deliveryFee: 62.00,
    zipCodes: [
      '11046', '11703', '11901', '11932', '11933', '11937', '11941', '11942', '11944', '11949', 
      '11959', '11960', '11962', '11963', '11968', '11969', '11972', '11976', '11977', '11978'
    ]
  }
};

export const VALID_ZIP_CODES = new Set();
Object.values(DELIVERY_ZONES).forEach(zone => {
  zone.zipCodes.forEach(zip => VALID_ZIP_CODES.add(zip));
});

export const isValidZipCode = (zipCode) => {
  if (!zipCode) return false;
  const cleanZip = zipCode.toString().replace(/\s+/g, '').slice(0, 5);
  return VALID_ZIP_CODES.has(cleanZip);
};

export const getDeliveryZoneInfo = (zipCode) => {
  if (!zipCode) return null;
  
  const cleanZip = zipCode.toString().replace(/\s+/g, '').slice(0, 5);
  
  for (const [key, zone] of Object.entries(DELIVERY_ZONES)) {
    if (zone.zipCodes.includes(cleanZip)) {
      return {
        zoneKey: key,
        name: zone.name,
        deliveryFee: zone.deliveryFee
      };
    }
  }
  
  return null;
};

export const extractZipCode = (address) => {
  if (!address) return null;
  
  const zipMatch = address.match(/\b\d{5}\b/);
  return zipMatch ? zipMatch[0] : null;
};

export const validateDeliveryAddress = (address) => {
  const zipCode = extractZipCode(address);
  
  if (!zipCode) {
    return {
      isValid: false,
      error: 'Please enter a complete address with zip code',
      zipCode: null,
      zone: null
    };
  }
  
  if (!isValidZipCode(zipCode)) {
    return {
      isValid: false,
      error: 'Sorry, we don\'t deliver to this area yet. Please try a different address.',
      zipCode,
      zone: null
    };
  }
  
  const zone = getDeliveryZoneInfo(zipCode);
  
  return {
    isValid: true,
    error: null,
    zipCode,
    zone
  };
}; 

const waitForGoogleMaps = (maxWait = 5000) => {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps && window.google.maps.Geocoder) {
      resolve();
      return;
    }

    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (window.google && window.google.maps && window.google.maps.Geocoder) {
        clearInterval(checkInterval);
        resolve();
      } else if (Date.now() - startTime > maxWait) {
        clearInterval(checkInterval);
        reject(new Error('Google Maps API did not load in time'));
      }
    }, 100);
  });
};

export const validateAddressWithGeocoding = async (address) => {
  try {
    // Check if Google Maps is available, wait for it if loading
    try {
      await waitForGoogleMaps(3000);
    } catch (waitError) {
      // Google Maps not available, fall back to static validation
      console.warn('Google Maps not available, using static validation:', waitError);
      const staticResult = validateDeliveryAddress(address);
      // Convert static result to match geocoding format
      return {
        isValid: staticResult.isValid,
        reason: staticResult.isValid ? 'zip_code' : 'outside_delivery_area',
        zipCode: staticResult.zipCode,
        zone: staticResult.zone,
        coordinates: null,
        formattedAddress: address
      };
    }

    // Verify Google Maps is actually available
    if (!window.google || !window.google.maps || !window.google.maps.Geocoder) {
      // Fall back to static validation
      const staticResult = validateDeliveryAddress(address);
      return {
        isValid: staticResult.isValid,
        reason: staticResult.isValid ? 'zip_code' : 'outside_delivery_area',
        zipCode: staticResult.zipCode,
        zone: staticResult.zone,
        coordinates: null,
        formattedAddress: address
      };
    }

    const geocoder = new window.google.maps.Geocoder();
    
    return new Promise((resolve, reject) => {
      geocoder.geocode({ address }, (results, status) => {
        if (status === 'OK' && results && results.length > 0) {
          const result = results[0];
          const location = result.geometry.location;
          const lat = location.lat();
          const lng = location.lng();
          
          let zipCode = null;
          for (const component of result.address_components) {
            if (component.types.includes('postal_code')) {
              zipCode = component.long_name;
              break;
            }
          }
          
          if (zipCode && isValidZipCode(zipCode)) {
            const zone = getDeliveryZoneInfo(zipCode);
            resolve({
              isValid: true,
              reason: 'zip_code',
              zipCode,
              zone,
              coordinates: { lat, lng },
              formattedAddress: result.formatted_address
            });
            return;
          }
          
          const isInDeliveryArea = isCoordinateInDeliveryArea(lat, lng);
          
          if (isInDeliveryArea) {
            resolve({
              isValid: true,
              reason: 'coordinates',
              zipCode: null,
              zone: null,
              coordinates: { lat, lng },
              formattedAddress: result.formatted_address
            });
          } else {
            resolve({
              isValid: false,
              reason: 'outside_delivery_area',
              zipCode: null,
              zone: null,
              coordinates: { lat, lng },
              formattedAddress: result.formatted_address
            });
          }
        } else {
          // Geocoding failed, fall back to static validation
          console.warn(`Geocoding failed with status: ${status}, falling back to static validation`);
          const staticResult = validateDeliveryAddress(address);
          resolve({
            isValid: staticResult.isValid,
            reason: staticResult.isValid ? 'zip_code' : 'outside_delivery_area',
            zipCode: staticResult.zipCode,
            zone: staticResult.zone,
            coordinates: null,
            formattedAddress: address
          });
        }
      });
    });
  } catch (error) {
    // If geocoding fails completely, fall back to static validation
    console.warn('Geocoding error, falling back to static validation:', error);
    const staticResult = validateDeliveryAddress(address);
    return {
      isValid: staticResult.isValid,
      reason: staticResult.isValid ? 'zip_code' : 'outside_delivery_area',
      zipCode: staticResult.zipCode,
      zone: staticResult.zone,
      coordinates: null,
      formattedAddress: address
    };
  }
};

const isCoordinateInDeliveryArea = (lat, lng) => {
  
  const bounds = {
    north: 41.5,
    south: 40.4,
    east: -73.5,
    west: -74.3
  };
  
  return lat >= bounds.south && lat <= bounds.north && 
         lng >= bounds.west && lng <= bounds.east;
}; 