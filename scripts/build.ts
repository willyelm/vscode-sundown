/**
 * Builder
 * @author Williams Medina <williams.medina@alpsinc.com>
 */
import * as fs from 'fs';
import { promisify } from 'util';
import * as path from 'path';
import { Builder, parseString } from 'xml2js';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const XMLBuilder = new Builder();
const XMLParse = promisify(parseString);
const fileTokens = require('./file-tokens.json');

async function buildIcons (ns: string, resolution: number) {
  const icons = {
    'iconDefinitions': {
      [`sundown.${ns}.folder`]: {
        "iconPath": `./${ns}-${resolution}-Folder.svg`
      },
      [`sundown.${ns}.project`]: {
        "iconPath": `./${ns}-${resolution}-Project.svg`
      },
      [`sundown.${ns}.file`]: {
        "iconPath": `./${ns}-${resolution}-File.svg`
      },
      [`sundown.${ns}.archive`]: {
        "iconPath": `./${ns}-${resolution}-Archive.svg`
      },
      [`sundown.${ns}.package`]: {
        "iconPath": `./${ns}-${resolution}-Package.svg`
      }
    },
    'fileExtensions': {
      'zip': `sundown.${ns}.archive`,
      'rar': `sundown.${ns}.archive`,
      'tar': `sundown.${ns}.archive`,
      'sbx': `sundown.${ns}.archive`,
      'gz': `sundown.${ns}.archive`,
      'gzip': `sundown.${ns}.archive`,
      '7z': `sundown.${ns}.archive`,
      's7z': `sundown.${ns}.archive`
    },
    "fileNames": {
      'package.json': `sundown.${ns}.package`,
      'Package.swift': `sundown.${ns}.package`
    },
    'rootFolder': `sundown.${ns}.project`,
    'rootFolderExpanded': `sundown.${ns}.project`,
    'folder': `sundown.${ns}.folder`,
    'folderExpanded': `sundown.${ns}.folder`,
    'file': `sundown.${ns}.file`
  };
  const fileNames = [
    'Archive',
    'File',
    'Folder',
    'Project',
    'Package'
  ]
  for(const name of fileNames) {
    // Copy Icons
    await copy(
      path.resolve(__dirname, `icons/${ns}-${name}.svg`), 
      path.resolve(`fileicons/${ns}-${resolution}-${name}.svg`)
    )
  }
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
  ns: string,
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
  const filePath = path.resolve(__dirname, `icons/${ns}-File.svg`);
  await fileTokens.reduce((promise, token) => {
    return promise.then(() => { 
      return new Promise(async (resolve) => {
        const fileSVG = await readSVG(filePath);
        const fileIconPath = path.resolve(__dirname, `languages/${ns}-${token.definition}.svg`);
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
        const fileXMLPath = path.resolve(`fileicons/${ns}-${resolution}-${token.definition}.svg`);
        await writeFile(fileXMLPath, fileXMLContent);
        // Add Definitions
        const iconTokenName = `sundown.${ns}.file.${token.definition}`;
        fileIcons.iconDefinitions[iconTokenName] = {
          iconPath: `./${ns}-${resolution}-${token.definition}.svg`
        };
        const definitions = ['fileExtensions', 'languageIds', 'fileNames'];
        definitions.forEach((item: string) => {
          if (!token[item]) return;
          const items = Array.isArray(token[item]) ? token[item] : [token[item]];
          items.forEach(async (definition: string) => {
            fileIcons[item][definition] = iconTokenName;
            // const fileTypePath = path.resolve(`fileicons/${ns}-${resolution}-${token.definition}.${definition}`);
            // await writeFile(fileTypePath, '');
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

async function build() {
  // Color icons
  const themeNames = ['dark'];
  for (const name of themeNames) {
    const iconTheme = {};
    const icons = await buildIcons(name, 24);
    const fileIcons = await buildFileIcons(
        name,
        32, 
        32, 
        32, 
        19, 
        26);
    merge(
      iconTheme, 
      icons,
      fileIcons
    );
    const themePath = path.resolve(`fileicons/${name}-icon.json`);
    await writeFile(themePath, JSON.stringify(iconTheme, null, 2));
  }
}

build();