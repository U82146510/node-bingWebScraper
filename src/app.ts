import fs, { link } from 'fs';
import { load } from 'cheerio';
const dorks:string[] = ['inurl:php?id=', 'inurl:asp?id='];
const pagesPerDork:number = 5;
const delayMs:number = 2000;

interface Progress{
    [dork: string]: number;
}

let progress:Progress = {};

if(fs.existsSync('progress.json')){
    progress=JSON.parse(fs.readFileSync('progress.json','utf-8'));
};

let savedDomains = new Set<string>();

if(fs.existsSync('domains.txt')){
    const lines = fs.readFileSync('domains.txt','utf-8').split('\n').filter(Boolean);
    lines.forEach(line=>savedDomains.add(line));
};

function sleep(ms:number):Promise<void>{
    return new Promise(resolve=>setTimeout(resolve,ms));
};

function saveProgress(){
    fs.writeFileSync('progress.json',JSON.stringify(progress,null,2))
};

function saveDomains(domains:string[]){
    const uniqueNew = domains.filter(d=> !savedDomains.has(d));
    if(uniqueNew.length>0){
        fs.appendFileSync('domains.txt',uniqueNew.join('\n')+ '\n');
        uniqueNew.forEach(d=>savedDomains.add(d))
        console.log(`💾 Saved ${uniqueNew.length} new domains`);
    }
}

async function scrapeBing(dork:string):Promise<string[]>{
    let startPage = progress[dork] ?? 0;
    const urls:string[]=[];
    for(let i = 0 ; i<pagesPerDork;i++){
        const offset = i * 10;
        const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(dork)}&first=${offset}`;
        try {
            const res = await fetch(searchUrl,{
                 headers:{'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
            });

            const html = await res.text();
            const $ = load(html);

            $("li.b_algo h2 a").each((_, el) => {
                const link = $(el).attr("href");
                if (link && link.startsWith("http")) {
                    try {
                    const domain = new URL(link).hostname;
                    urls.push(domain);
                    } catch {
                        console.error('Error at extracting hostname from url class');
                    }
                }
            });
            for(const url of urls){
                savedDomains.add(url);
            }
            saveDomains(urls);

            progress[dork]=i+1;
            saveProgress();
            console.log(`Dork: "${dork}" Page: ${i + 1} => Collected ${urls.length} URLs`);
            await sleep(delayMs);
        } catch (error) {
            console.error(error);
        }
    }
    return urls;
};


async function start() {
    const allUrls:string[] = [];
    for(const dork of dorks){
        const urls = await scrapeBing(dork);
        allUrls.push(...urls)
    };
    const domains:string[] = [...new Set(allUrls)];
    fs.writeFileSync('domains.txt',domains.join('\n'))
    console.log(`✅ Done! ${domains.length} unique domains saved to domains.txt`);
}


start()