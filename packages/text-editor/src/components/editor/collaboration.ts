//
// Copyright © 2023 Hardcore Engineering Inc.
//
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may
// obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
//

import { type DecorationAttrs } from '@tiptap/pm/view'
import { getPlatformColor, closeTooltip, showTooltip } from '@hcengineering/ui'
import { type CollaborationUser } from '../../types'
import CollaborationUserPopup from '../CollaborationUserPopup.svelte'

export const renderCursor = (user: CollaborationUser): HTMLElement => {
  const color = getPlatformColor(user.color, false)

  const cursor = document.createElement('span')
  cursor.classList.add('collaboration-cursor__cursor')
  cursor.setAttribute('style', `border-color: ${color}`)

  const caret = document.createElement('div')
  caret.classList.add('collaboration-cursor__caret')
  caret.setAttribute('style', `border-color: ${user.color}`)
  cursor.appendChild(caret)

  caret.addEventListener('mousemove', () => {
    showTooltip(undefined, caret, 'top', CollaborationUserPopup, { user })
  })
  caret.setAttribute('id', user.id)

  const handler = (data: any, observer: any): void => {
    data.forEach((item: any) => {
      if (item.type === 'attributes') {
        if (item.target.attributes.typing.nodeValue === '1') {
          showTooltip(undefined, caret, 'top', CollaborationUserPopup, { user }, undefined, undefined, 'sticky_tooltip')
        } else {
          closeTooltip()
        }
      }
    })
  }

  const observer = new MutationObserver(handler)
  observer.observe(caret, { attributes: true, attributeOldValue: true, attributeFilter: ['typing'] })

  return cursor
}

export const noSelectionRender = (_user: CollaborationUser): DecorationAttrs => ({})
