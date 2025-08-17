import fs from 'fs';
import { load } from 'cheerio';

type DorkType = 'php' | 'asp' | 'jsp' | 'node';

interface DomainInfo {
    domain: string;
    type: DorkType;
}

// Define your dorks with types
const dorks: { dork: string; type: DorkType }[] = [
    // PHP
    { dork: 'inurl:index.php?id=', type: 'php' },
    { dork: 'inurl:product.php?id=', type: 'php' },
    { dork: 'inurl:view.php?id=', type: 'php' },
    { dork: 'inurl:page.php?id=', type: 'php' },
    { dork: 'inurl:news.php?id=', type: 'php' },
    { dork: 'inurl:search.php?query=', type: 'php' },
    { dork: 'inurl:user.php?uid=', type: 'php' },
    { dork: 'inurl:profile.php?id=', type: 'php' },
    { dork: 'inurl:login.php?redirect=', type: 'php' },
    { dork: 'inurl:catalog.php?catid=', type: 'php' },

    // ASP
    { dork: 'inurl:default.asp?id=', type: 'asp' },
    { dork: 'inurl:home.asp?id=', type: 'asp' },
    { dork: 'inurl:search.asp?query=', type: 'asp' },

    // JSP
    { dork: 'inurl:index.jsp?id=', type: 'jsp' },
    { dork: 'inurl:product.jsp?id=', type: 'jsp' },
    { dork: 'inurl:view.jsp?id=', type: 'jsp' },
    { dork: 'inurl:page.jsp?id=', type: 'jsp' },
    { dork: 'inurl:news.jsp?id=', type: 'jsp' },
    { dork: 'inurl:search.jsp?query=', type: 'jsp' },

];

const pagesPerDork = 5;
const delayMs = 2000;

let progress: Record<string, number> = {};
if (fs.existsSync('progress.json')) {
    progress = JSON.parse(fs.readFileSync('progress.json', 'utf-8'));
}

let savedDomains = new Set<string>();
if (fs.existsSync('domains.txt')) {
    const lines = fs.readFileSync('domains.txt', 'utf-8').split('\n').filter(Boolean);
    lines.forEach(line => savedDomains.add(line));
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function saveProgress() {
    fs.writeFileSync('progress.json', JSON.stringify(progress, null, 2));
}

function saveDomains(domains: DomainInfo[]) {
    const uniqueNew = domains.filter(d => !savedDomains.has(d.domain));
    if (uniqueNew.length > 0) {
        fs.appendFileSync('domains.txt', uniqueNew.map(d => d.domain).join('\n') + '\n');
        uniqueNew.forEach(d => savedDomains.add(d.domain));
        console.log(`💾 Saved ${uniqueNew.length} new domains`);
    }
}

async function scrapeBing(dork: string, type: DorkType): Promise<DomainInfo[]> {
    const urls: DomainInfo[] = [];
    for (let i = 0; i < pagesPerDork; i++) {
        const offset = i * 10;
        const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(dork)}&first=${offset}`;
        try {
            const res = await fetch(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
            const html = await res.text();

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
                        urls.push({ domain, type });
                    } catch {}
                }
            });

            const uniqueUrls = [...new Map(urls.map(u => [u.domain, u])).values()]; // remove duplicates
            saveDomains(uniqueUrls);
            progress[dork] = i + 1;
            saveProgress();
            console.log(`Dork: "${dork}" Page: ${i + 1} => Collected ${uniqueUrls.length} URLs`);
            await sleep(delayMs);

        } catch (error) {
            console.error(error);
        }
    }
    return urls;
}

async function start() {
    const allUrls: DomainInfo[] = [];

    for (const { dork, type } of dorks) {
        const urls = await scrapeBing(dork, type);
        allUrls.push(...urls);
    }

    // Deduplicate globally by domain
    const domainInfos = [...new Map(allUrls.map(u => [u.domain, u])).values()];
    fs.writeFileSync('domains.txt', domainInfos.map(d => d.domain).join('\n'));
    console.log(`✅ Done! ${domainInfos.length} unique domains saved to domains.txt`);

    // Parameters by type
    const phpParameters = ['index.php?id=1','product.php?id=1','view.php?id=1','page.php?id=1','news.php?id=1','search.php?query=test','user.php?uid=1','profile.php?id=1','login.php?redirect=1','catalog.php?catid=1'];
    const aspParameters = ['default.asp?id=1','home.asp?id=1','search.asp?query=test'];
    const jspParameters = ['index.jsp?id=1','product.jsp?id=1','view.jsp?id=1','page.jsp?id=1','news.jsp?id=1','search.jsp?query=test'];

    const sqlmapUrls: string[] = [];

    for (const info of domainInfos) {
        if (info.type === 'php') sqlmapUrls.push(...phpParameters.map(p => `http://${info.domain}/${p}`));
        else if (info.type === 'asp') sqlmapUrls.push(...aspParameters.map(p => `http://${info.domain}/${p}`));
        else if (info.type === 'jsp') sqlmapUrls.push(...jspParameters.map(p => `http://${info.domain}/${p}`));
    }

    fs.writeFileSync('sqlmap_urls.txt', sqlmapUrls.join('\n'));
    console.log(`✅ Done! ${sqlmapUrls.length} sqlmap-ready URLs saved to sqlmap_urls.txt`);
}

start();
