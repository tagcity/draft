//@ts-check
import cheerio from 'cheerio';
import got from 'got';

/**
 *
 * @param {number} num
 */
export async function fetchImages(num) {
  const promises = Array.from({ length: num }, () => getImage());
  const images = await Promise.all(promises);
  return images;
}

async function getImage() {
  const MAX_NUMBER = 350000;
  const chosenImage = Math.round(MAX_NUMBER * Math.random());
  const url = `https://archillect.com/${chosenImage}`;
  const result = await got(url).text();
  const $ = cheerio.load(result);
  return $('img#ii').attr('src');
}
