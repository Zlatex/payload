import { fromBuffer } from 'file-type';
import fs from 'fs';
import sanitize from 'sanitize-filename';
import sharp from 'sharp';
import { SanitizedCollectionConfig } from '../collections/config/types';
import { PayloadRequest } from '../express/types';
import fileExists from './fileExists';
import { ProbedImageSize } from './getImageSize';
import { FileSizes, FileToSave, ImageSize } from './types';

type Args = {
  req: PayloadRequest
  file: Buffer
  dimensions: ProbedImageSize
  staticPath: string
  config: SanitizedCollectionConfig
  savedFilename: string
  mimeType: string
}

type OutputImage = {
  name: string,
  extension: string,
  width: number,
  height: number
}

type Result = Promise<{
  sizeData: FileSizes
  sizesToSave: FileToSave[]
}>

function getOutputImage(sourceImage: string, size: ImageSize): OutputImage {
  const extension = sourceImage.split('.').pop();
  const name = sanitize(sourceImage.substring(0, sourceImage.lastIndexOf('.')) || sourceImage);

  return {
    name,
    extension,
    width: size.width,
    height: size.height,
  };
}

export default async function resizeAndSave({
  req,
  file,
  dimensions,
  staticPath,
  config,
  savedFilename,
}: Args): Promise<Result> {
  const { imageSizes } = config.upload;
  const sizesToSave: FileToSave[] = [];
  const sizeData = {};

  const promises = imageSizes
    .map(async (desiredSize) => {
      if (!needsResize(desiredSize, dimensions)) {
        sizeData[desiredSize.name] = {
          url: null,
          width: null,
          height: null,
          filename: null,
          filesize: null,
          mimeType: null,
        };
        return;
      }
      let resized = sharp(file).resize(desiredSize);

      if (desiredSize.formatOptions) {
        resized = resized.toFormat(desiredSize.formatOptions.format, desiredSize.formatOptions.options);
      }

      const bufferObject = await resized.toBuffer({
        resolveWithObject: true,
      });

      req.payloadUploadSizes[desiredSize.name] = bufferObject.data;

      const mimeType = (await fromBuffer(bufferObject.data));
      const outputImage = getOutputImage(savedFilename, desiredSize);
      const imageNameWithDimensions = createImageName(outputImage, bufferObject, mimeType.ext);
      const imagePath = `${staticPath}/${imageNameWithDimensions}`;
      const fileAlreadyExists = await fileExists(imagePath);

      if (fileAlreadyExists) {
        fs.unlinkSync(imagePath);
      }

      sizesToSave.push({
        path: imagePath,
        buffer: bufferObject.data,
      });

      sizeData[desiredSize.name] = {
        width: bufferObject.info.width,
        height: bufferObject.info.height,
        filename: imageNameWithDimensions,
        filesize: bufferObject.info.size,
        mimeType: mimeType.mime,
      };
    });

  await Promise.all(promises);

  return {
    sizeData,
    sizesToSave,
  };
}
function createImageName(
  outputImage: OutputImage,
  bufferObject: { data: Buffer; info: sharp.OutputInfo },
  extension: string,
): string {
  return `${outputImage.name}-${bufferObject.info.width}x${bufferObject.info.height}.${extension}`;
}

function needsResize(desiredSize: ImageSize, dimensions: ProbedImageSize): boolean {
  return (typeof desiredSize.width === 'number' && desiredSize.width <= dimensions.width)
    || (typeof desiredSize.height === 'number' && desiredSize.height <= dimensions.height);
}
