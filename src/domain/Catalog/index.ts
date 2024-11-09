import { Browser, Page } from "puppeteer";
import { ExtractedProductSelectorsI, PageExtractionI, ProductExtractionI, ExtractProductInfoI, ProductExtractedI } from "./interface";
import { injectable, inject } from "inversify";
import TaskExecution from "../TaskExecution";
import ElemExtraction from "../ElemExtraction";
import { PAGE_INFO_CHUNK_SIZE, PRODUCT_SELECTOR_CHUNK_SIZE, siteArr } from "../../global";
import Puppeteer from "../Puppeteer";
import ProductExtraction from "../ProductExtraction";
import CatalogRepository from "../../infra/database/mysql/repository/Catalog";

@injectable()
class Catalog extends ProductExtraction {
    constructor(
        @inject(TaskExecution) protected taskExecution: TaskExecution,
        @inject(ElemExtraction) protected elemExtraction: ElemExtraction,
        @inject(Puppeteer) protected puppeteer: Puppeteer,
        @inject(CatalogRepository) private catalogRepository: CatalogRepository
    ) {
        super(taskExecution, elemExtraction, puppeteer);
        this.extractProductData = this.extractProductData.bind(this);
    }

    async extract(): Promise<void> {
        const browser = await this.puppeteer.newBrowser();

        try {
            const siteInfo = this.siteInfoMaker();

            const allSitePagesInfoToExtractData = await this.getAllSitesPagesInfo(browser, siteInfo);

            const pageExtractionInfo: PageExtractionI = {
                puppeteerClass: browser,
                extractionData: allSitePagesInfoToExtractData,
                chunkSize: PAGE_INFO_CHUNK_SIZE,
                extractFunction: this.extracPageData
            };

            const products = await this.taskExecution.executeExtraction(pageExtractionInfo);

            console.log("=======>> Products extracted: ", products);

            // await this.catalogRepository.bulkCreate(products);
            //
            // console.log("=======>> Saved sucessfully.");
        } catch (err: any) {
            console.error("Error extracting products. Error: ", err);
        } finally {
            await browser.close();
        }
    }

    override async extractProductData(page: Page, extractProductInfo: ExtractProductInfoI): Promise<any> {
        try {
            const { site, baseUrl, type, nameRegex, ...productSelectors } = extractProductInfo;
            let resultObj: any = {
                site,
                type
            };

            for (const [key, selector] of Object.entries(productSelectors)) {
                switch (key) {
                    case "soldOut":
                        const isSoldOut = await this.elemExtraction.getText(page, selector, true);
                        resultObj[key] = !!isSoldOut;
                        break;
                    case "endpoint":
                        const endpoint = await this.elemExtraction.getHref(page, selector);
                        if (endpoint.includes("http")) resultObj["url"] = endpoint;
                        else resultObj["url"] = baseUrl + endpoint;
                        break;
                    case "name":
                        const name = await this.elemExtraction.getText(page, selector);
                        if(!name){
                            resultObj["name"] = "";
                            break;
                        } 
                        resultObj["name"] = name;
                        for (const [key, regex] of Object.entries(nameRegex)) {
                            const foundMatch = name.match(regex);

                            if (!foundMatch) resultObj[key] = "";
                            else resultObj[key] = foundMatch[0];
                        }
                        break;
                    default:
                        resultObj[key] = await this.elemExtraction.getText(page, selector);
                        break;
                }
            }

            return resultObj;
        } catch (err: any) {
            err.productSelectors = extractProductInfo;
            throw err;
        }
    }

    private siteInfoMaker() {
        const siteInfoArr = siteArr.map(site => {
            const resultArr = [];
            for (let [typeKey, typeValue] of Object.entries(site.type)) {
                resultArr.push({
                    extractProductInfo: {
                        name: site.selectors.catalog.productNameSelector,
                        soldOut: site.selectors.catalog.soldOutSelector,
                        endpoint: site.selectors.catalog.productEndpointSelector,
                        baseUrl: site.baseUrl,
                        site: site.site,
                        type: typeKey,
                        nameRegex: typeValue.nameRegex
                    },
                    commonSelectors: site.selectors.common,
                    extractUrl: typeValue.extractUrl,
                });
            }

            return resultArr;
        }).flat();

        return siteInfoArr;
    }
}

export default Catalog;
