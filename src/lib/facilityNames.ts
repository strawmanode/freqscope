import airportsData from '../data/airports.json'
import { getAirspace } from './airspace'

const airports = airportsData as { icao: string; name: string }[]

const ARTCC_NAMES: Record<string, string> = {
  ZAB: 'ALBUQUERQUE CENTER',
  ZAU: 'CHICAGO CENTER',
  ZBW: 'BOSTON CENTER',
  ZDC: 'WASHINGTON CENTER',
  ZDV: 'DENVER CENTER',
  ZFW: 'DALLAS-FT WORTH CENTER',
  ZHU: 'HOUSTON CENTER',
  ZID: 'INDIANAPOLIS CENTER',
  ZJX: 'JACKSONVILLE CENTER',
  ZKC: 'KANSAS CITY CENTER',
  ZLA: 'LOS ANGELES CENTER',
  ZLC: 'SALT LAKE CITY CENTER',
  ZMA: 'MIAMI CENTER',
  ZME: 'MEMPHIS CENTER',
  ZMP: 'MINNEAPOLIS CENTER',
  ZNY: 'NEW YORK CENTER',
  ZOA: 'OAKLAND CENTER',
  ZOB: 'CLEVELAND CENTER',
  ZSE: 'SEATTLE CENTER',
  ZTL: 'ATLANTA CENTER',
}

const TRACON_NAMES: Record<string, string> = {
  KATL: 'A80 ATLANTA TRACON',
  KORD: 'C90 CHICAGO TRACON',
  KMDW: 'C90 CHICAGO TRACON',
  KLAX: 'SCT SOUTHERN CALIFORNIA TRACON',
  KSAN: 'SCT SOUTHERN CALIFORNIA TRACON',
  KJFK: 'N90 NEW YORK TRACON',
  KSFO: 'NCT NORTHERN CALIFORNIA TRACON',
  KDFW: 'D10 DALLAS-FORT WORTH TRACON',
  KDEN: 'D01 DENVER TRACON',
  KLAS: 'L30 LAS VEGAS TRACON',
  KSEA: 'S46 SEATTLE TRACON',
  KBOS: 'A90 BOSTON TRACON',
  KDCA: 'PCT POTOMAC TRACON',
  KIAD: 'PCT POTOMAC TRACON',
  KBWI: 'PCT POTOMAC TRACON',
  KIAH: 'I90 HOUSTON TRACON',
  KHOU: 'I90 HOUSTON TRACON',
  KDTW: 'D21 DETROIT TRACON',
  KMSP: 'M98 MINNEAPOLIS TRACON',
  KSTL: 'T75 ST. LOUIS TRACON',
  KMCO: 'F11 CENTRAL FLORIDA TRACON',
  KTPA: 'F11 CENTRAL FLORIDA TRACON',
  KPHX: 'P50 PHOENIX TRACON',
  KSLC: 'S56 SALT LAKE CITY TRACON',
  KMEM: 'M03 MEMPHIS TRACON',
  KMIA: 'MIA MIAMI APPROACH',
  KPHL: 'PHL PHILADELPHIA APPROACH',
  KCLT: 'CLT CHARLOTTE APPROACH',
  KCLE: 'CLE CLEVELAND APPROACH',
  KPIT: 'PIT PITTSBURGH APPROACH',
  KSAT: 'SAT SAN ANTONIO APPROACH',
  KCVG: 'CVG CINCINNATI APPROACH',
  KMCI: 'MCI KANSAS CITY APPROACH',
}

const TWR_NAMES: Record<string, string> = {
  KATL: 'ATLANTA TOWER',
  KORD: 'CHICAGO O\'HARE TOWER',
  KLAX: 'LOS ANGELES TOWER',
  KJFK: 'KENNEDY TOWER',
  KSFO: 'SAN FRANCISCO TOWER',
  KDFW: 'DALLAS-FORT WORTH TOWER',
  KDEN: 'DENVER TOWER',
  KLAS: 'LAS VEGAS TOWER',
  KMIA: 'MIAMI TOWER',
  KSEA: 'SEATTLE TOWER',
  KBOS: 'BOSTON TOWER',
  KPHL: 'PHILADELPHIA TOWER',
  KDCA: 'WASHINGTON NATIONAL TOWER',
  KIAD: 'DULLES TOWER',
  KBWI: 'BALTIMORE TOWER',
  KIAH: 'HOUSTON INTERCONTINENTAL TOWER',
  KHOU: 'HOBBY TOWER',
  KDTW: 'DETROIT TOWER',
  KCLT: 'CHARLOTTE TOWER',
  KMSP: 'MINNEAPOLIS TOWER',
  KSTL: 'ST. LOUIS TOWER',
  KCLE: 'CLEVELAND TOWER',
  KPIT: 'PITTSBURGH TOWER',
  KMCO: 'ORLANDO TOWER',
  KTPA: 'TAMPA TOWER',
  KSAN: 'SAN DIEGO TOWER',
  KPHX: 'PHOENIX TOWER',
  KSLC: 'SALT LAKE CITY TOWER',
  KMEM: 'MEMPHIS TOWER',
  KSAT: 'SAN ANTONIO TOWER',
  KCVG: 'CINCINNATI TOWER',
  KMCI: 'KANSAS CITY INTERNATIONAL TOWER',
  KMDW: 'MIDWAY TOWER',
}

function shortenAirportName(name: string): string {
  return name
    .replace(' International Airport', '')
    .replace(' Regional Airport', '')
    .replace(' Airport', '')
    .toUpperCase()
}

export function getTwrName(icao: string): string {
  if (TWR_NAMES[icao]) return TWR_NAMES[icao]
  const airport = airports.find((a) => a.icao === icao)
  const name = airport
    ? shortenAirportName(airport.name)
    : icao.slice(1)
  return `${name} TOWER`
}

export function getAppName(icao: string): string {
  if (TRACON_NAMES[icao]) return TRACON_NAMES[icao]
  const airport = airports.find((a) => a.icao === icao)
  const name = airport ? shortenAirportName(airport.name) : icao
  return `${name} APPROACH`
}

export function getCtrName(icao: string): string {
  const airspace = getAirspace(icao)
  const artcc = airspace.artcc
  if (artcc && ARTCC_NAMES[artcc]) return `${artcc} ${ARTCC_NAMES[artcc]}`
  return artcc ? `${artcc} CENTER` : 'EN ROUTE CENTER'
}

export function getFacilityName(icao: string, altFilter: 'TWR' | 'TRACON' | 'CTR' | 'ALL'): string {
  switch (altFilter) {
    case 'TWR':
      return getTwrName(icao)
    case 'TRACON':
      return getAppName(icao)
    case 'CTR':
      return getCtrName(icao)
    case 'ALL':
      return 'ALL FACILITIES'
  }
}
