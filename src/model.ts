import { Context } from 'koishi'

declare module 'koishi' {
    interface Tables {
        'wall6.meta': meta
        'wall6.records_1_0_0': WallRecord
        'wall6.idols_1_0_0': Idol
    }
}

interface Idol_1_0_0 {
    id: number
    nickname: string
    guild_id: string
    isRecording: boolean
}

interface WallRecord_1_0_0 {
    id?: number
    idol_id: number
    desription: string
    time: Date
    guild_id: string
    version: string
}

export type Idol = Idol_1_0_0;
export type WallRecord = WallRecord_1_0_0;

const latestVersion = '1_0_0';

export const recordTablename = 'wall6.records_1_0_0';
export const idolsTablename = 'wall6.idols_1_0_0';

export interface meta {
    id: number
    database_version: string
}

export async function apply(ctx: Context) {

    ctx.model.extend('wall6.meta', {
        id: 'unsigned',
        database_version: {
            type: 'string',
            nullable: true,
        },
    }, {
        autoInc: true,
    })

    const data_base_meta = await ctx.database.get('wall6.meta', [1], ['database_version'])

    if (data_base_meta.length != 0) {
        upgradeDatabase(ctx, data_base_meta[0].database_version);
    } else {
        createDatabase(ctx);
    }

}

function upgradeDatabase(ctx: Context, current_version: string) {
    if (current_version == latestVersion) {
        return;
    }

    //Just an example
    switch (current_version) {
        case '1_0_0':
            current_version = "1_0_1"
            break;
    }

    return upgradeDatabase(ctx, current_version)
}

function createDatabase(ctx: Context) {
    ctx.model.extend(idolsTablename, {
        id: 'unsigned',
        nickname: {
            type: 'string',
            nullable: false,
        },
        guild_id: {
            type: 'string',
            nullable: false,
        },
        isRecording: {
            type: 'boolean',
            initial: false,
            nullable: false,
        },
    }, {
        autoInc: true,
    })

    ctx.model.extend(recordTablename, {
        id: 'unsigned',
        idol_id: {
            type: 'unsigned',
            nullable: false,
        },
        desription: {
            type: 'text',
            nullable: false,
        },
        time: {
            type: 'timestamp',
            nullable: true,
        },
        guild_id: {
            type: 'string',
            nullable: false,
        },
        version: {
            type: 'string',
            nullable: false,
        }
    },
        {
            autoInc: true,
            foreign: {
                idol_id: [idolsTablename, 'id']
            }
        })
}