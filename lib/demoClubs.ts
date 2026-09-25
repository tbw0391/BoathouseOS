// Clubs from the 2026 Head of the Cuyahoga entry list (RegattaCentral), so
// demo visitors can see BoatHouseOS in their own club's colors. Colors were
// pulled from each club's blade image and darkened where needed so white
// text on them stays readable. `colors: null` means no blade on file, so the
// default BoatHouseOS colors are used.

export type DemoClub = {
  slug: string;
  name: string;
  location: string;
  blade: string | null;
  colors: { primary: string; secondary: string; accent: string } | null;
};

export const DEMO_CLUBS: DemoClub[] = [
  {
    slug: "ann-arbor-rowing-club",
    name: "Ann Arbor Rowing Club",
    location: "Ann Arbor, MI",
    blade: "/branding/clubs/ann-arbor-rowing-club.png",
    colors: { primary: "#ea0000", secondary: "#0000fe", accent: "#a40000" },
  },
  {
    slug: "buckeye-rowing-club",
    name: "Buckeye Rowing Club",
    location: "Powell, OH",
    blade: "/branding/clubs/buckeye-rowing-club.png",
    colors: { primary: "#ea0000", secondary: "#000000", accent: "#a40000" },
  },
  {
    slug: "case-western-reserve-university-crew-tea",
    name: "Case Western Reserve University Crew Team",
    location: "Cleveland, OH",
    blade: "/branding/clubs/case-western-reserve-university-crew-tea.png",
    colors: { primary: "#0055d4", secondary: "#000000", accent: "#003b94" },
  },
  {
    slug: "central-catholic-rowing-club-central-cat",
    name: "Central Catholic Rowing Club/Central Catholic High School",
    location: "Toledo, OH",
    blade: "/branding/clubs/central-catholic-rowing-club-central-cat.png",
    colors: { primary: "#d8241b", secondary: "#010101", accent: "#971913" },
  },
  {
    slug: "central-ohio-rowing",
    name: "Central Ohio Rowing",
    location: "Dublin, OH",
    blade: "/branding/clubs/central-ohio-rowing.png",
    colors: { primary: "#008033", secondary: "#003380", accent: "#005a24" },
  },
  {
    slug: "chautauqua-lake-rowing-association-inc",
    name: "Chautauqua Lake Rowing Association, Inc.",
    location: "Jamestown, NY",
    blade: "/branding/clubs/chautauqua-lake-rowing-association-inc.png",
    colors: { primary: "#002a00", secondary: "#800000", accent: "#001d00" },
  },
  {
    slug: "chicago-rowing-union",
    name: "Chicago Rowing Union",
    location: "Evanston, IL",
    blade: "/branding/clubs/chicago-rowing-union.png",
    colors: { primary: "#0b6cfe", secondary: "#333333", accent: "#014ab8" },
  },
  {
    slug: "cincinnati-rowing-club",
    name: "Cincinnati Rowing Club",
    location: "Newport, KY",
    blade: "/branding/clubs/cincinnati-rowing-club.png",
    colors: { primary: "#32007f", secondary: "#217844", accent: "#230059" },
  },
  {
    slug: "cleveland-foundry-juniors",
    name: "Cleveland Foundry Juniors",
    location: "Cleveland, OH",
    blade: "/branding/clubs/cleveland-foundry-juniors.png",
    colors: { primary: "#c04d00", secondary: "#000000", accent: "#863600" },
  },
  {
    slug: "cleveland-rowing-foundation",
    name: "Cleveland Rowing Foundation",
    location: "Cleveland, OH",
    blade: "/branding/clubs/cleveland-rowing-foundation.png",
    colors: { primary: "#040404", secondary: "#404040", accent: "#030303" },
  },
  {
    slug: "cleveland-state-university-rowing-club-v",
    name: "Cleveland State University Rowing Club, \"Viking Crew\"",
    location: "Cleveland, OH",
    blade: "/branding/clubs/cleveland-state-university-rowing-club-v.png",
    colors: { primary: "#005400", secondary: "#478447", accent: "#003b00" },
  },
  {
    slug: "dayton-boat-club",
    name: "Dayton Boat Club",
    location: "Moraine, OH",
    blade: "/branding/clubs/dayton-boat-club.png",
    colors: { primary: "#0b6cfe", secondary: "#116cf3", accent: "#014ab8" },
  },
  {
    slug: "detroit-boat-club-crew",
    name: "Detroit Boat Club Crew",
    location: "Detroit, MI",
    blade: "/branding/clubs/detroit-boat-club-crew.png",
    colors: { primary: "#0b6dfe", secondary: "#e90101", accent: "#014bb8" },
  },
  {
    slug: "east-grand-rapids-crew-team",
    name: "East Grand Rapids Crew Team",
    location: "East Grand Rapids, MI",
    blade: "/branding/clubs/east-grand-rapids-crew-team.png",
    colors: { primary: "#0000fe", secondary: "#8a6d00", accent: "#0000b2" },
  },
  {
    slug: "grand-rapids-rowing-club",
    name: "Grand Rapids Rowing Club",
    location: "Grand Rapids, MI",
    blade: "/branding/clubs/grand-rapids-rowing-club.png",
    colors: { primary: "#a90000", secondary: "#404040", accent: "#760000" },
  },
  {
    slug: "great-miami-rowing-center",
    name: "Great Miami Rowing Center",
    location: "Hamilton, OH",
    blade: "/branding/clubs/great-miami-rowing-center.png",
    colors: { primary: "#d7232a", secondary: "#021c3d", accent: "#96191d" },
  },
  {
    slug: "greater-columbus-rowing-association",
    name: "Greater Columbus Rowing Association",
    location: "Columbus, OH",
    blade: "/branding/clubs/greater-columbus-rowing-association.png",
    colors: { primary: "#b05e08", secondary: "#946e45", accent: "#7b4205" },
  },
  {
    slug: "heroes-movement",
    name: "Heroes' Movement",
    location: "Wyandotte, MI",
    blade: "/branding/clubs/heroes-movement.png",
    colors: { primary: "#030303", secondary: "#3d3d3d", accent: "#020202" },
  },
  {
    slug: "huron-rowing-association-ann-arbor-huron",
    name: "Huron Rowing Association - Ann Arbor Huron H.S.",
    location: "Ann Arbor, MI",
    blade: "/branding/clubs/huron-rowing-association-ann-arbor-huron.png",
    colors: { primary: "#026103", secondary: "#8b723a", accent: "#014402" },
  },
  {
    slug: "indianapolis-rowing-center",
    name: "Indianapolis Rowing Center",
    location: "Indianapolis, IN",
    blade: "/branding/clubs/indianapolis-rowing-center.png",
    colors: { primary: "#eb0000", secondary: "#1d1d1d", accent: "#a40000" },
  },
  {
    slug: "jaguars-rowing",
    name: "Jaguars Rowing",
    location: "Indianapolis, IN",
    blade: "/branding/clubs/jaguars-rowing.png",
    colors: { primary: "#d40000", secondary: "#8d7100", accent: "#940000" },
  },
  {
    slug: "john-carroll-university-rowing",
    name: "John Carroll University Rowing",
    location: "University Heights, OH",
    blade: "/branding/clubs/john-carroll-university-rowing.png",
    colors: { primary: "#00007f", secondary: "#28206b", accent: "#000059" },
  },
  {
    slug: "lincoln-park-boat-club",
    name: "Lincoln Park Boat Club",
    location: "Chicago, IL",
    blade: null,
    colors: null,
  },
  {
    slug: "louisville-rowing-club-inc",
    name: "Louisville Rowing Club, Inc.",
    location: "Louisville, KY",
    blade: "/branding/clubs/louisville-rowing-club-inc.png",
    colors: { primary: "#00007f", secondary: "#8e7100", accent: "#000059" },
  },
  {
    slug: "magnificat-high-school",
    name: "Magnificat High School",
    location: "Rocky River, OH",
    blade: "/branding/clubs/magnificat-high-school.png",
    colors: { primary: "#3457a3", secondary: "#5975b4", accent: "#243d72" },
  },
  {
    slug: "miami-university-rowing-club",
    name: "Miami University Rowing Club",
    location: "Oxford, OH",
    blade: "/branding/clubs/miami-university-rowing-club.png",
    colors: { primary: "#ea0000", secondary: "#e91616", accent: "#a40000" },
  },
  {
    slug: "mt-lebanon-high-school-crew-club",
    name: "Mt. Lebanon High School Crew Club",
    location: "Pittsburgh, PA",
    blade: "/branding/clubs/mt-lebanon-high-school-crew-club.png",
    colors: { primary: "#071d48", secondary: "#847500", accent: "#051432" },
  },
  {
    slug: "ou-club-crew",
    name: "OU Club Crew",
    location: "Athens, OH",
    blade: null,
    colors: null,
  },
  {
    slug: "parkersburg-south-hs-crew",
    name: "Parkersburg South HS Crew",
    location: "Parkersburg, WV",
    blade: "/branding/clubs/parkersburg-south-hs-crew.png",
    colors: { primary: "#030356", secondary: "#7e4141", accent: "#02023c" },
  },
  {
    slug: "perrysburg-rowing-club",
    name: "Perrysburg Rowing Club",
    location: "Toledo, OH",
    blade: "/branding/clubs/perrysburg-rowing-club.png",
    colors: { primary: "#1a1a1a", secondary: "#827120", accent: "#121212" },
  },
  {
    slug: "portage-lakes-rowing-association",
    name: "Portage Lakes Rowing Association",
    location: "New Franklin, OH",
    blade: "/branding/clubs/portage-lakes-rowing-association.png",
    colors: { primary: "#c14d00", secondary: "#000055", accent: "#873600" },
  },
  {
    slug: "queen-city-water-sports-center",
    name: "Queen City Water Sports Center",
    location: "Cincinnati, OH",
    blade: "/branding/clubs/queen-city-water-sports-center.png",
    colors: { primary: "#db3316", secondary: "#404040", accent: "#99240f" },
  },
  {
    slug: "rocky-mountain-rowing-club",
    name: "Rocky Mountain Rowing Club",
    location: "Aurora, CO",
    blade: "/branding/clubs/rocky-mountain-rowing-club.png",
    colors: { primary: "#00007f", secondary: "#e80100", accent: "#000059" },
  },
  {
    slug: "saint-joseph-academy",
    name: "Saint Joseph Academy",
    location: "Cleveland, OH",
    blade: "/branding/clubs/saint-joseph-academy.png",
    colors: { primary: "#4400a9", secondary: "#8d7100", accent: "#300076" },
  },
  {
    slug: "shaker-heights-high-school-crew",
    name: "Shaker Heights High School Crew",
    location: "Shaker Heights, OH",
    blade: "/branding/clubs/shaker-heights-high-school-crew.png",
    colors: { primary: "#ea0000", secondary: "#000000", accent: "#a40000" },
  },
  {
    slug: "south-bend-community-rowing-co",
    name: "South Bend Community Rowing,CO.",
    location: "South Bend, IN",
    blade: "/branding/clubs/south-bend-community-rowing-co.png",
    colors: { primary: "#010155", secondary: "#8a6d00", accent: "#01013b" },
  },
  {
    slug: "st-edward-high-school",
    name: "St. Edward High School",
    location: "Lakewood, OH",
    blade: "/branding/clubs/st-edward-high-school.png",
    colors: { primary: "#185d45", secondary: "#757314", accent: "#114130" },
  },
  {
    slug: "st-francis-de-sales-high-school-and-pare",
    name: "St. Francis de Sales High School and Parents Association (LLC)",
    location: "Toledo, OH",
    blade: "/branding/clubs/st-francis-de-sales-high-school-and-pare.png",
    colors: { primary: "#d30000", secondary: "#04007c", accent: "#940000" },
  },
  {
    slug: "st-ignatius-wildcat-rowing",
    name: "St. Ignatius Wildcat Rowing",
    location: "Cleveland, OH",
    blade: "/branding/clubs/st-ignatius-wildcat-rowing.png",
    colors: { primary: "#00007f", secondary: "#8d7201", accent: "#000059" },
  },
  {
    slug: "st-john-s-jesuit-high-school",
    name: "St. John's Jesuit High School",
    location: "Toledo, OH",
    blade: "/branding/clubs/st-john-s-jesuit-high-school.png",
    colors: { primary: "#003365", secondary: "#876d37", accent: "#002447" },
  },
  {
    slug: "st-ursula-academy-crew",
    name: "St. Ursula Academy Crew",
    location: "Toledo, OH",
    blade: "/branding/clubs/st-ursula-academy-crew.png",
    colors: { primary: "#00007c", secondary: "#8a6d00", accent: "#000057" },
  },
  {
    slug: "steel-city-rowing-club",
    name: "Steel City Rowing Club",
    location: "Verona, PA",
    blade: "/branding/clubs/steel-city-rowing-club.png",
    colors: { primary: "#7f0080", secondary: "#8a6d00", accent: "#59005a" },
  },
  {
    slug: "three-rivers-rowing-association",
    name: "Three Rivers Rowing Association",
    location: "Pittsburgh, PA",
    blade: "/branding/clubs/three-rivers-rowing-association.png",
    colors: { primary: "#d40000", secondary: "#023567", accent: "#940000" },
  },
  {
    slug: "upper-arlington-crew-inc",
    name: "Upper Arlington Crew, Inc.",
    location: "Upper Arlington, OH",
    blade: "/branding/clubs/upper-arlington-crew-inc.png",
    colors: { primary: "#1a1a1a", secondary: "#8e7100", accent: "#121212" },
  },
  {
    slug: "western-reserve-rowing-association",
    name: "Western Reserve Rowing Association",
    location: "Cleveland, OH",
    blade: "/branding/clubs/western-reserve-rowing-association.png",
    colors: { primary: "#8800a9", secondary: "#008000", accent: "#5f0076" },
  },
  {
    slug: "westerville-rowing-club",
    name: "Westerville Rowing Club",
    location: "Westerville, OH",
    blade: "/branding/clubs/westerville-rowing-club.png",
    colors: { primary: "#000080", secondary: "#7070b1", accent: "#00005a" },
  },
  {
    slug: "wyandotte-boat-club",
    name: "Wyandotte Boat Club",
    location: "Wyandotte, MI",
    blade: "/branding/clubs/wyandotte-boat-club.png",
    colors: { primary: "#0669fe", secondary: "#2b71db", accent: "#0149b5" },
  },
];

export const DEMO_CLUB_COOKIE = "demo_club";

export function findDemoClub(slug: string | null | undefined): DemoClub | null {
  if (!slug) return null;
  return DEMO_CLUBS.find((c) => c.slug === slug) ?? null;
}
