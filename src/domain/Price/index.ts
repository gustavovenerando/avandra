import { Page } from "puppeteer";
import { PageExtractionI, ExtractProductInfoI } from "./interface";
import { injectable, inject } from "inversify";
import TaskExecution from "../TaskExecution";
import ElemExtraction from "../ElemExtraction";
import { PAGE_INFO_CHUNK_SIZE, siteArr } from "../../global";
import Puppeteer from "../Puppeteer";
import ProductExtraction from "../ProductExtraction";
import PriceRepository from "../../infra/database/mysql/repository/Price";

@injectable()
class Price extends ProductExtraction {
    constructor(
        @inject(TaskExecution) protected taskExecution: TaskExecution,
        @inject(ElemExtraction) protected elemExtraction: ElemExtraction,
        @inject(Puppeteer) protected puppeteer: Puppeteer,
        @inject(PriceRepository) private priceRepository: PriceRepository
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

            const prices = await this.taskExecution.executeExtraction(pageExtractionInfo);

            console.log("=======>> Products extracted: ", prices);

            // await this.priceRepository.bulkCreate(prices);
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
            const { 
                site,
                baseUrl,
                type,
                soldOut,
                ...productSelectors
            } = extractProductInfo;

            let resultObj: any = { };

            const isSoldOut = await this.elemExtraction.getText(page, productSelectors.soldOut, true);

            if(!!isSoldOut) return resultObj;

            for (const [key, selector] of Object.entries(productSelectors)) {
                switch (key) {
                    case "endpoint":
                        const endpoint = await this.elemExtraction.getHref(page, selector);
                        if (endpoint.includes("http")) resultObj["url"] = endpoint;
                        else resultObj["url"] = baseUrl + endpoint;
                        break;
                    case "pix":
                        resultObj[key] = await this.elemExtraction.getText(page, selector);
                        break;
                    case "credit":
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
            for (let typeValue of Object.values(site.type)) {
                resultArr.push({
                    extractProductInfo: {
                        pix: site.selectors.price.pixSelector,
                        credit: site.selectors.price.creditSelector,
                        soldOut: site.selectors.catalog.soldOutSelector,
                        endpoint: site.selectors.catalog.productEndpointSelector,
                        baseUrl: site.baseUrl,
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

export default Price;
