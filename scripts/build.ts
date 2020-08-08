import * as fs from 'fs';
import { promisify } from 'util';
import * as path from 'path';
import { Builder, parseString } from 'xml2js';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const XMLBuilder = new Builder();
const XMLParse = promisify(parseString);

async function buildIcons (resolution: number) {
  const icons = {
    'iconDefinitions': {
      'Sundown.Folder': {
        "iconPath": `./${resolution}/Folder.svg`
      },
      'Sundown.Project': {
        "iconPath": `./${resolution}/Project.svg`
      },
      'Sundown.File': {
        "iconPath": `./${resolution}/File.svg`
      },
      'Sundown.Archive': {
        "iconPath": `./${resolution}/Archive.svg`
      }
    },
    'fileExtensions': {
      'zip': 'Sundown.Archive',
      'rar': 'Sundown.Archive',
      'tar': 'Sundown.Archive',
      'sbx': 'Sundown.Archive',
      'gz': 'Sundown.Archive',
      'gzip': 'Sundown.Archive',
      '7z': 'Sundown.Archive',
      's7z': 'Sundown.Archive'
    },
    'rootFolder': 'Sundown.Project',
    'rootFolderExpanded': 'Sundown.Project',
    'folder': 'Sundown.Folder',
    'folderExpanded': 'Sundown.Folder',
    'file': 'Sundown.File'
  };
  // Copy Icons
  await copy(
    path.resolve(__dirname, `icons/File.svg`), 
    path.resolve(`fileicons/${resolution}/File.svg`)
  )
  await copy(
    path.resolve(__dirname, `icons/Folder.svg`), 
    path.resolve(`fileicons/${resolution}/Folder.svg`)
  )
  await copy(
    path.resolve(__dirname, `icons/Project.svg`), 
    path.resolve(`fileicons/${resolution}/Project.svg`)
  )
  await copy(
    path.resolve(__dirname, `icons/Archive.svg`), 
    path.resolve(`fileicons/${resolution}/Archive.svg`)
  )
  return icons;
}

async function copy (target: string, dest: string) {
  return fs
    .createReadStream(target)
    .pipe(fs.createWriteStream(dest));
}

async function readSVG (filePath: string, options?: any) {
  const fileSVGBuffer = await readFile(filePath);
  let fileSVGContent = fileSVGBuffer.toString();
  if (options && options.idPrefix) {
    const newIds = {};
    fileSVGContent = fileSVGContent.replace(/id="([\w-.+]*)"/g, (match, id) => {
      const newId = `${options.idPrefix}-${id}`;
      newIds[id] = newId;
      return `id="${newId}"`;
    });
    fileSVGContent = fileSVGContent.replace(/#([\w-.+]*)/g, (match, id) => {
      const newId = newIds[id] || id;
      return `#${newId}`;
    });
  }
  return await XMLParse(fileSVGContent);
}

async function buildFileIcons (
  resolution: number,
  containerWidth: number,
  containerHeight: number,
  containerX: number,
  containerY: number
) {
  const fileIcons = {
    'iconDefinitions': {},
    'fileExtensions': {},
    'fileNames': {},
    'languageIds': {}
  }
  const fileTokens = require('./file-tokens.json');
  const filePath = path.resolve(__dirname, `icons/File.svg`);
  
  await fileTokens.reduce((promise, token) => {
    return promise.then(() => { 
      return new Promise(async (resolve) => {
        const fileSVG = await readSVG(filePath);
        const fileIconPath = path.resolve(__dirname, `icons/languages/${token.definition}.svg`);
        const fileIconSVG = await readSVG(fileIconPath, {
          idPrefix: token.definition 
        });
        
        if (!fileSVG.svg.defs) { 
          fileSVG.svg.defs = [{}];
        }
        // Add Symbol Definition
        Object.assign(fileSVG.svg.defs[0], {
          symbol: [{
            $: {
              id: 'FileIcon'
            },
            g: fileIconSVG.svg.g
          }]
        });
        if (fileIconSVG.svg.defs && fileIconSVG.svg.defs[0]) {
          merge(fileSVG.svg.defs[0], fileIconSVG.svg.defs[0]);
        }
        // Place Symbol
        Object.assign(fileSVG.svg, {
          use: [{
            $: {
              'x': containerX,
              'y': containerY,
              'width': containerWidth,
              'height': containerHeight,
              'xlink:href': '#FileIcon'
            }
          }]
        })
        // Save File
        const fileXMLContent = XMLBuilder.buildObject(fileSVG);
        const fileXMLPath = path.resolve(`fileicons/${resolution}/icons/${token.definition}.svg`);
        await writeFile(fileXMLPath, fileXMLContent);
        // Add Definitions
        const iconTokenName = `Sundown.File.${token.definition}`;
        fileIcons.iconDefinitions[iconTokenName] = {
          iconPath: `./${resolution}/icons/${token.definition}.svg`
        };
        const definitions = ['fileExtensions', 'languageIds', 'fileNames'];
        definitions.forEach((item: string) => {
          if (!token[item]) return;
          const items = Array.isArray(token[item]) ? token[item] : [token[item]];
          items.forEach(async (definition: string) => {
            fileIcons[item][definition] = iconTokenName;
            const fileTypePath = path.resolve(`fileicons/${resolution}/icons/${token.definition}.${definition}`);
            await writeFile(fileTypePath, '');
          });
        });
        resolve(fileSVG);
      });
    })
  }, Promise.resolve());
  return fileIcons;
}

function merge (...items) {
  const master = items.shift();
  items.reduce((previous, current) => {
    Object
      .keys(current)
      .filter((name) => {
        const value = current[name];
        return previous[name] && typeof value == 'object';
      })
      .forEach((name: string) => {
        if (Array.isArray(current[name])) {
          current[name] = [...previous[name], ...current[name]];
        } else {
          current[name] = merge(previous[name], current[name]);
        }
      });
    return Object.assign(previous, current);
  }, master);
  return master;
}

async function build () {
  const iconTheme = {};
  const icons = await buildIcons(24);
  const fileIcons = await buildFileIcons(24, 16, 16, 5, 10.05);
  merge(
    iconTheme, 
    icons,
    fileIcons
  );
  const themePath = path.resolve(`fileicons/fileicons-theme.json`);
  await writeFile(themePath, JSON.stringify(iconTheme, null, 2));
}

build();