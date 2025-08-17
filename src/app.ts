import fs, { link } from 'fs';
import { load } from 'cheerio';


const dorks: string[] = [
    // PHP
    'inurl:index.php?id=',
    'inurl:product.php?id=',
    'inurl:view.php?id=',
    'inurl:page.php?id=',
    'inurl:news.php?id=',
    'inurl:search.php?query=',
    'inurl:user.php?uid=',
    'inurl:profile.php?id=',
    'inurl:login.php?redirect=',
    'inurl:catalog.php?catid=',

    // ASP
    'inurl:default.asp?id=',
    'inurl:home.asp?id=',
    'inurl:search.asp?query=',

    // JSP
    'inurl:index.jsp?id=',
    'inurl:product.jsp?id=',
    'inurl:view.jsp?id=',
    'inurl:page.jsp?id=',
    'inurl:news.jsp?id=',
    'inurl:search.jsp?query=',

    // Node/Express (no file extension)
    'inurl:/users/',
    'inurl:/products/',
    'inurl:/orders/',
    'inurl:/profile/',
    'inurl:/search?query='
];


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

            // check captcha
            if (html.includes("Enter the characters you see") || html.includes("captcha")) {
                console.log("⚠️ Captcha detected, stopping this dork.");
                break;
            }

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

    const parameters = [
        // PHP
        'index.php?id=1',
        'product.php?id=1',
        'view.php?id=1',
        'page.php?id=1',
        'news.php?id=1',
        'search.php?query=test',
        'user.php?uid=1',
        'profile.php?id=1',
        'login.php?redirect=1',
        'catalog.php?catid=1',

        // ASP
        'default.asp?id=1',
        'home.asp?id=1',
        'search.asp?query=test',

        // JSP
        'index.jsp?id=1',
        'product.jsp?id=1',
        'view.jsp?id=1',
        'page.jsp?id=1',
        'news.jsp?id=1',
        'search.jsp?query=test',

        // Node/Express style (no extension)
        'users/1',
        'products/1',
        'orders/1',
        'search?query=test',
        'profile/1'
    ];


    const sqlmapUrls = domains.flatMap(d =>
    parameters.map(p => `http://${d}/${p}`)
    );

    fs.writeFileSync('sqlmap_urls.txt', sqlmapUrls.join('\n'));
    console.log(`✅ Done! ${sqlmapUrls.length} sqlmap-ready URLs saved to sqlmap_urls.txt`);

}

start()