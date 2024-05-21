import { Context, Schema, $, h, Dict } from 'koishi'

import { Chart, registerables } from 'chart.js/auto'
import { createCanvas, registerFont } from 'canvas'
import ChartDataLabels from 'chartjs-plugin-datalabels';

import { Idol, WallRecord, idolsTablename, apply as modelApply, recordTablename } from './model'

export { WallRecord, Idol, recordTablename, idolsTablename } from './model'

export const name = 'wall-bot-plugin'

// 对于整体依赖的服务，使用 inject 属性声明依赖关系
export const inject = {
  required: ['database', 'assets'],
}

export interface Config {
  genshin_version: string,
  font_file?: string,
}

export const Config: Schema<Config> = Schema.object({
  genshin_version: Schema.string().required(),
  font_file: Schema.path({
    allowCreate: true,
    filters: ['.ttf'],
  } as any)
})

export async function apply(ctx: Context, config: Config) {

  await modelApply(ctx);

  if (config.font_file != undefined && config.font_file != "") {
    registerFont(config.font_file, { family: 'genshinImpact' });

    Chart.register(...registerables);
    Chart.register(ChartDataLabels);
  }

  
  // write your plugin here
  ctx.on('message', async (session) => {
    if (session.content.includes('重建数据库')) {

      await ctx.database.drop(idolsTablename);
      await ctx.database.drop(recordTablename);

      await modelApply(ctx);

      session.send('宝塔镇河妖')
    }


  });


  // Create
  ctx.command('送偶像上墙 <user:string> <message:text>', '添加南墙记录')
    .usage('注意：请确保偶像名称的一致性，如有空格或特殊符号请用引号。')
    .example('送偶像上墙 三月 太慢导致队友太快')
    .action(async (_, user, message) => {

      const guild_id = _.session.guildId ? _.session.guildId : "console";

      const idols: Idol[] = await ctx.database.get(idolsTablename, {
        nickname: user,
        guild_id: guild_id,
      });

      var idol = null;

      // Create Idol If not exists
      if (idols.length == 0) {

        idol = {
          nickname: user,
          guild_id: guild_id,
          isRecording: true,
        }

        idol = await ctx.database.create(idolsTablename, idol);
      } else {
        idol = idols[0];
      }

      const record : WallRecord = {
        idol_id: idol.id,
        desription: message,
        time: new Date(_.session.timestamp),
        guild_id: guild_id,
        version: config.genshin_version,
      }

      const result_record = await ctx.database.create(recordTablename, record);

      return `成功送${idol.nickname}上墙！`;
    });

  // Read
  ctx.command('南墙记录 [version:string]', '查询南墙记录')
    .option('name', '-n <name:string> 查询指定偶像记录')
    .option('delete', '-d 列出记录id用于删除指令')
    .usage('注意：如不填写版本号默认查询当前版本，如需查询所有请填写 "all" ')
    .example('南墙记录 4.5 查询4.5版本南墙记录')
    .example('南墙记录 all 查询所有版本南墙记录')
    .example('南墙记录 4.3 -n 三月 查询三月在v4.3版本南墙记录')
    .action(async ({ session, options }, version) => {
      const guild_id = session.guildId ? session.guildId : "console";

      var query = ctx.database.join([recordTablename, idolsTablename], (records, idols) => $.eq(records.idol_id, idols.id));

      if (version == undefined) {
        version = config.genshin_version
      }

      query = query.where(row => $.eq(row[recordTablename].guild_id, guild_id))

      if (version != 'all') {
        query = query.where(row => $.eq(row[recordTablename].version, version))
      }

      if (options.name) {
        query = query.where(row => $.eq(row[idolsTablename].nickname, options.name))
      }

      const records = await query
        .project({
          name: row => row[idolsTablename].nickname,
          description: row => row[recordTablename].desription,
          id: row => row[recordTablename].id,
        })
        .execute()

      const result = records.map((record) => `${options.delete ? 'ID: ' + record.id + ' ' : ''}${record.name} ${record.description}`).join('\n');

      return result;
    });

  // Update
  // TODO

  // Delete  
  ctx.command('删除南墙记录')
    .option('id', '-i <id:number> 指定记录id删除')
    .usage('注意：必须带选项来进行删除 ')
    .example('删除南墙记录 -i 10086 删除id为10086的南墙记录')
    .action(async ({ options }) => {


      if (options.id) {
        const result = await ctx.database.remove(recordTablename, [options.id])

        if (!result.matched) {
          return `删除失败，记录id:${options.id}不存在`;
        }

        return `删除成功。`
      }


      return `<>
      请带参数，
      <execute>help 删除南墙记录</execute>
      </>`

    });


  ctx.command('添加南墙记录')
    .subcommand('批量添加')
    .usage('注意：请传入列为“name, resaon, version”逗号分割的文本 ')
    .action(async ({ session }) => {

      const guild_id = session.guildId ? session.guildId : "console";


      await session.send('请输入列为“name, resaon, version”逗号分割的文本')

      const text = await session.prompt()
      if (!text) return '输入超时。'

      await text.split('\n').map(async line => {
        const words: string[] = line.split(',').map(s => s.trim())

        const name = words[0];
        const description = words[1];
        const version = words[2];

        const idols: Idol[] = await ctx.database.get(idolsTablename, {
          nickname: name,
          guild_id: guild_id,
        });

        var idol;

        // Create Idol If not exists
        if (idols.length == 0) {

          idol = {
            nickname: name,
            guild_id: guild_id,
            isRecording: true,
          }

          idol = await ctx.database.create(idolsTablename, idol);
        } else {
          idol = idols[0];
        }

        var record = {
          idol_id: idol.id,
          desription: description,
          time: null,
          guild_id: guild_id,
          version: version,
        }

        record = await ctx.database.create(recordTablename, record);
      })

      return `添加成功`

    });

  ctx.command('南墙统计')
    .action(async ({session}) => {

      const guild_id = session.guildId ? session.guildId : "console";
      const canvas = createCanvas(1000, 1000)
      const canvas_ctx = canvas.getContext('2d')

      canvas_ctx.font = '32px genshinImpact';

      const result = await ctx.database
        .join([recordTablename, idolsTablename], (records, idols) => $.eq(records.idol_id, idols.id))
        .where(row => $.eq(row[recordTablename].guild_id, guild_id))
        .groupBy([idolsTablename + '.nickname', recordTablename + '.version'] as any, {
          name: row => row[idolsTablename].nickname,
          version: row => row[recordTablename].version,
          count: row => $.count(row[recordTablename].id),
        })
        .orderBy('count', 'desc')
        .execute();

      // Create a map to hold versions and their respective datasets
      const versionMap : {[key: string]: Array<Dict>} = {};

      result.forEach(row => {
        const { version, name, count } = row;
        if (!versionMap[version]) {
          versionMap[version] = [];
        }
        versionMap[version].push({ name, count });
      });

      // Process the data to keep only the top 4 for each version and group the rest as "Others"
      const datasets = [];

      Object.entries(versionMap).forEach(([version, data], index) => {
        // Sort data by count in descending order
        data.sort((a, b) => b.count - a.count);

        // Take the top 4 and group the rest as "Others"
        const top4 = data.slice(0, 4);
        const others = data.slice(4);

        const othersCount = others.reduce((sum, item) => sum + item.count, 0);

        // Create labels and data arrays
        const versionLabels = top4.map(item => `${item.name} (v${version})`);
        const versionData = top4.map(item => item.count);

        if (othersCount > 0) {
          versionLabels.push(`Others (v${version})`);
          versionData.push(othersCount);
        }

        datasets.push({
          label: `Version ${version}`,
          data: versionData,
          datalabels: {
            labels: {
              title: {
                formatter: (value, context) => {
                  return versionLabels[context.dataIndex];
                }
              }
            }
          }
        });
      });

      const myChart = new Chart(canvas_ctx as any, {
        type: 'doughnut',
        data: {
          labels: [],
          datasets: datasets
        },
        options: {
          responsive: true,
          plugins: {
            tooltip: {
              callbacks: {
                label: function(context) {
                  let label = context.label || '';
                  if (label) {
                    label += ': ';
                  }
                  if (context.parsed !== null) {
                    label += context.parsed;
                  }
                  return label;
                }
              }
            },
            datalabels: {
              color: 'white',
              display: true,
              font: {
                weight: 'bold'
              },
            }
          }
        },
        plugins: [ChartDataLabels]
      });

      const buf = await canvas.toBuffer();

      //return h.image(buf, 'image/png');
      return '以下是图片记录' + h.image(buf, 'image/png');
    })

}
