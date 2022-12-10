import {mkdirSync} from 'fs';
import {stat, writeFile} from 'fs/promises';
import fetch from 'node-fetch';
import path from 'node:path';
import xmldoc = require('xmldoc');

const pubmedIdQuery = `“ACF02Query”[ti] OR "atrial fibrillation" AND ((Acenocoumarol OR apixaban OR argatroban OR betrixaban OR bivalirudin OR Dabigatran OR Dalteparin OR danaparoid OR desirudin OR edoxaban OR Enoxaparin OR Fondaparinux OR Heparin* OR Hirudins OR lepirudin OR Rivaroxaban OR Warfarin OR "oral anticoagulation" OR "direct oral anticoagulants" OR DOACs OR Anticoagula*) OR (Abciximab OR "acetylsalicylic acid" OR Aspirin OR cangrelor OR Cilostazol OR Clopidogrel OR Dipyridamole OR eptifibitide OR Pentoxifylline OR "Prasugrel Hydrochloride" OR Ticagrelor OR Ticlopidine OR Tirofiban OR antiplatelet OR Antithrombotic)) AND "last 14 days"=[dp] AND english[LA] NOT (mouse OR mice OR dog OR dogs OR chicken OR chickens OR cat OR cats OR canine* OR monkey* OR rat OR rats OR porcine*)`;

const pubmedBaseUrl =
  'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmax=500&term=';

const buildNbibDownloadUrl = (id: string) =>
  `https://api.ncbi.nlm.nih.gov/lit/ctxp/v1/pubmed/?format=medline&contenttype=json&id=${id}&download=y`;

/**
 * Downloads a set of NBIB files corresponding to a Pubmed query
 *
 * @export
 * @param {string} query - Unencoded pubmed query phrase
 * @param {string} outputFolder - Path in which NBIB files should be written
 */
export async function writeNbibFilesToOutput(
  query: string,
  outputFolder: string
) {
  // Get pubmed ids from search query
  const pubmedIdResponse = await fetch(pubmedBaseUrl + encodeURI(query));
  const pubmedIdText = await pubmedIdResponse.text();

  // Parse Id file to xml
  const xml = new xmldoc.XmlDocument(pubmedIdText);

  // Filter IdList for elements and retrieve Id value
  const ids = xml
    .childNamed('IdList')
    ?.children.filter(child => child.type === 'element')
    .map(child => (child as xmldoc.XmlElement).val);

  //Write to output folder in pwd
  const writeFolder = path.join(__dirname, outputFolder);

  // Make output directory if one does not exist.
  // Not sure if this is the right way to do it -- this is how Go handles it
  await stat(writeFolder).catch(() => mkdirSync(writeFolder));

  // Go through each pubmedId and fetch the NBIB file from pubmed
  while (ids?.length) {
    const id = ids.shift() as string;
    const downloadUrl = buildNbibDownloadUrl(id);
    const downloadResponse = await fetch(downloadUrl);
    const nbibFile = await downloadResponse.arrayBuffer();

    // For non relative paths, you can use __dirname
    const savePath = path.join(writeFolder, `${id}.nbib`);

    // Write nbib file to output folder
    writeFile(savePath, Buffer.from(nbibFile));

    // Pubmed is rate limited to 3 requests per second.
    // Since this is not a time-sensitive operation, I send one request every 500 ms
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

writeNbibFilesToOutput(pubmedIdQuery, './output');
