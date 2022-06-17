import { FC } from 'react'

import { ComponentSharedMedia } from '../.graphclient'
import { Image } from './Image'

interface MediaBlock {
  block: ComponentSharedMedia
}

export const MediaBlock: FC<MediaBlock> = ({ block }) => {
  return (
    <div className="flex flex-col gap-4 my-10">
      {block.file?.data && (
        <div className="relative overflow-hidden rounded-xl">
          <Image
            layout="responsive"
            objectFit="contain"
            image={block.file.data}
            className="rounded-xl overflow-hidden"
          />
        </div>
      )}
      {block.caption && <span className="text-xs font-bold text-slate-400">{block.caption}</span>}
    </div>
  )
}
