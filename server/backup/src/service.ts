//
// Copyright © 2024 Hardcore Engineering Inc.
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

import { BaseWorkspaceInfo, getWorkspaceId, type MeasureContext } from '@hcengineering/core'
import { type StorageAdapter } from '@hcengineering/server-core'
import { backup } from '.'
import { createStorageBackupStorage } from './storage'

async function getWorkspaces (accounts: string, token: string): Promise<BaseWorkspaceInfo[]> {
  const workspaces = await (
    await fetch(accounts, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        method: 'listWorkspaces',
        params: [token]
      })
    })
  ).json()

  return (workspaces.result as BaseWorkspaceInfo[]) ?? []
}

export interface BackupConfig {
  TransactorURL: string
  AccountsURL: string
  Token: string

  Interval: number // Timeout in seconds
  Timeout: number // Timeout in seconds
  BucketName: string
}

class BackupWorker {
  constructor (
    readonly storageAdapter: StorageAdapter,
    readonly config: BackupConfig
  ) {}

  canceled = false
  interval: any

  async close (): Promise<void> {
    this.canceled = true
    clearTimeout(this.interval)
  }

  async schedule (ctx: MeasureContext): Promise<void> {
    console.log('schedule timeout for', this.config.Interval, ' seconds')
    this.interval = setTimeout(() => {
      void this.backup(ctx).then(() => {
        void this.schedule(ctx)
      })
    }, this.config.Interval * 1000)
  }

  async backup (ctx: MeasureContext): Promise<void> {
    const workspaces = await getWorkspaces(this.config.AccountsURL, this.config.Token)
    workspaces.sort((a, b) => b.lastVisit - a.lastVisit)
    for (const ws of workspaces) {
      if (this.canceled) {
        return
      }
      await ctx.info('\n\nBACKUP WORKSPACE ', { workspace: ws.workspace, productId: ws.productId })
      try {
        const storage = await createStorageBackupStorage(
          ctx,
          this.storageAdapter,
          getWorkspaceId(this.config.BucketName, ws.productId),
          ws.workspace
        )
        await ctx.with('backup', { workspace: ws.workspace }, async (ctx) => {
          await backup(
            ctx,
            this.config.TransactorURL,
            getWorkspaceId(ws.workspace, ws.productId),
            storage,
            [],
            false,
            this.config.Timeout * 1000
          )
        })
      } catch (err: any) {
        await ctx.error('\n\nFAILED to BACKUP', { workspace: ws.workspace, err })
      }
    }
  }
}

export function backupService (ctx: MeasureContext, storage: StorageAdapter, config: BackupConfig): () => void {
  const backupWorker = new BackupWorker(storage, config)

  const shutdown = (): void => {
    void backupWorker.close()
  }

  void backupWorker.backup(ctx).then(() => {
    void backupWorker.schedule(ctx)
  })
  return shutdown
}
