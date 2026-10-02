// Photos on the built-in Rookie Parent guides (public/branding/guides),
// all from Wikimedia Commons. Their licenses need the credit shown next to
// each photo (CC BY / CC BY-SA), so keep these with the files.

export type GuidePhoto = {
  src: string;
  width: number;
  height: number;
  alt: string;
  author: string;
  license: string;
  licenseUrl: string | null;
  sourceUrl: string;
};

const commons = (file: string) => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, "_"))}`;

const BY_SA_4 = "https://creativecommons.org/licenses/by-sa/4.0/";
const BY_SA_3 = "https://creativecommons.org/licenses/by-sa/3.0/";

export const GUIDE_PHOTOS = {
  eightStern: {
    src: "/branding/guides/eight-stern.jpg",
    width: 1200,
    height: 800,
    alt: "A women's eight seen from behind the coxswain, with all eight rowers and their oars",
    author: "Ulrich Heinemann",
    license: "CC BY-SA 3.0 DE",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/de/deed.en",
    sourceUrl: commons("Frauenachter U23 (1).jpg"),
  },
  seatPositions: {
    src: "/branding/guides/seat-positions.png",
    width: 960,
    height: 394,
    alt: "Diagram of an eight: seats numbered 1 at the bow to 8 at the stern, then the cox, with the boat moving bow first",
    author: "Freshness2go",
    license: "CC BY-SA 3.0",
    licenseUrl: BY_SA_3,
    sourceUrl: commons("BoatPositions.png"),
  },
  slidingSeat: {
    src: "/branding/guides/sliding-seat.jpg",
    width: 960,
    height: 401,
    alt: "A rowing seat on its wheels, sitting on the two-rail track it slides along",
    author: "LoKiLeCh",
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
    sourceUrl: commons("Berlin Technikmuseum Rollsitz.jpg"),
  },
  footStretcher: {
    src: "/branding/guides/foot-stretcher.jpg",
    width: 700,
    height: 737,
    alt: "A rower's view of their feet strapped into the shoes of the foot stretcher, looking toward the stern",
    author: "Held der Arbeit0815",
    license: "CC BY-SA 3.0",
    licenseUrl: BY_SA_3,
    sourceUrl: commons("Fusssteuer.jpg"),
  },
  eight: {
    src: "/branding/guides/eight.jpg",
    width: 960,
    height: 639,
    alt: "An eight with a coxswain, rowing past the riverbank",
    author: "Team Bear Bones",
    license: "CC BY-SA 4.0",
    licenseUrl: BY_SA_4,
    sourceUrl: commons("Regent's Women 2019.jpg"),
  },
  coxedFour: {
    src: "/branding/guides/coxed-four.jpg",
    width: 960,
    height: 668,
    alt: "A coxed four from above, with the cox lying down in the bow",
    author: "Holger Ellgaard",
    license: "CC BY-SA 2.0 DE",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/de/deed.en",
    sourceUrl: commons("Vierer mit Steuermann.JPG"),
  },
  coxlessFour: {
    src: "/branding/guides/coxless-four.jpg",
    width: 1200,
    height: 675,
    alt: "A coxless four, each rower with one oar, sides alternating",
    author: "Cjp24",
    license: "CC BY-SA 4.0",
    licenseUrl: BY_SA_4,
    sourceUrl: commons("Championnat de France d'aviron 2019 (23).jpg"),
  },
  pair: {
    src: "/branding/guides/pair.jpg",
    width: 960,
    height: 640,
    alt: "A pair: two rowers, one oar each, on opposite sides",
    author: "John Slade",
    license: "Public domain",
    licenseUrl: null,
    sourceUrl: commons("GB Pair at Henley 2004.JPG"),
  },
  single: {
    src: "/branding/guides/single.jpg",
    width: 960,
    height: 640,
    alt: "A single sculler holding an oar in each hand",
    author: "Jillian MM",
    license: "CC BY-SA 4.0",
    licenseUrl: BY_SA_4,
    sourceUrl: commons("Single Sculler.jpg"),
  },
  double: {
    src: "/branding/guides/double.jpg",
    width: 1024,
    height: 384,
    alt: "A double: two scullers, each with two oars",
    author: "Traumrune",
    license: "CC BY-SA 3.0",
    licenseUrl: BY_SA_3,
    sourceUrl: commons("Aviron-charente 08.JPG"),
  },
  quad: {
    src: "/branding/guides/quad.jpg",
    width: 960,
    height: 418,
    alt: "A quad: four scullers, each with two oars",
    author: "Cjp24",
    license: "CC BY-SA 4.0",
    licenseUrl: BY_SA_4,
    sourceUrl: commons("Championnat de France d'aviron 2019 (10).jpg"),
  },
  scullers: {
    src: "/branding/guides/scullers.jpg",
    width: 1200,
    height: 900,
    alt: "Close-up of two scullers, each pulling two oars, one in each hand",
    author: "Cjp24",
    license: "CC BY-SA 4.0",
    licenseUrl: BY_SA_4,
    sourceUrl: commons("Championnat de France d'aviron 2019 (11).jpg"),
  },
} satisfies Record<string, GuidePhoto>;
