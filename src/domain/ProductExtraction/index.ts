import { Browser, Page } from "puppeteer";
import { ExtractedProductSelectorsI, PageExtractionI, ProductExtractionI, ExtractProductInfoI, ProductExtractedI } from "./interface";
import { injectable, inject } from "inversify";
import TaskExecution from "../TaskExecution";
import ElemExtraction from "../ElemExtraction";
import { PAGE_INFO_CHUNK_SIZE, PRODUCT_SELECTOR_CHUNK_SIZE, siteArr } from "../../global";
import Puppeteer from "../Puppeteer";

@injectable()
abstract class ProductExtraction {
    constructor(
        protected taskExecution: TaskExecution,
        protected elemExtraction: ElemExtraction,
        protected puppeteer: Puppeteer,
    ) {
        this.extracPageData = this.extracPageData.bind(this);
        this.extractProductData = this.extractProductData.bind(this);
    }

    protected async getAllSitesPagesInfo(browser: Browser, siteInfoArr: any[]): Promise<any[]> {
        const sitesPagesInfo = [];

        for (let siteInfo of siteInfoArr) {
            const numPageInfo = {
                numPageSelectors: siteInfo.commonSelectors,
                extractUrl: siteInfo.extractUrl
            }
            const numPages = await this.getNumPages(browser, numPageInfo);
            console.log("Number of pages: ", numPages);

            sitesPagesInfo.push(...this.getSitePagesInfo(numPages, siteInfo));
        }

        return sitesPagesInfo;
    }

    private getSitePagesInfo(numPages: number, siteInfo: any): any[] {
        const { extractUrl } = siteInfo;

        const pagesInfo = [];
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const url = extractUrl.replace("PAGE_NUM", `${pageNum}`);
            pagesInfo.push({ url, ...siteInfo });
        }

        return pagesInfo;
    }

    protected async extracPageData(browser: Browser, pageInfo: any): Promise<any[]> {
        const { url, commonSelectors: { productCardSelector }, extractProductInfo } = pageInfo;

        const page = await this.puppeteer.gotoNewPage(browser, url);

        try {
            if(!page) throw new Error("Couldnt go to new page.");

            const listSize = await this.elemExtraction.listLength(page, productCardSelector);
            console.log("List size: ", listSize, "- URL: ", url);

            const productInfoSelectors = this.getProductInfoSelelectors(extractProductInfo, listSize);

            const productExtractionInfo: any = {
                puppeteerClass: page,
                extractionData: productInfoSelectors,
                chunkSize: PRODUCT_SELECTOR_CHUNK_SIZE,
                extractFunction: this.extractProductData
            }

            const result = await this.taskExecution.executeExtraction(productExtractionInfo);

            return result;
        } catch (err: any) {
            err.url = pageInfo.url;
            throw err;
        } finally {
            await page.close();
        }
    }

    protected async extractProductData(page: Page, extractProductInfo: ExtractProductInfoI) {
    }

    private getProductInfoSelelectors(extractProductInfo: ExtractProductInfoI, listSize: number): any[] {
        const productInfoSelectors = [];
        const { nameRegex, ...selectors } = extractProductInfo;

        for (let i = 1; i <= listSize; i++) {
            const filledProductSelectors: ExtractProductInfoI = {};

            for (const [key, selector] of Object.entries(selectors)) {
                if (!selector) continue;
                filledProductSelectors[key] = selector.replace("INDEX", `${i}`);
            }

            let obj = { ...filledProductSelectors };
            if(nameRegex) obj = { ...obj, nameRegex};

            productInfoSelectors.push(obj);
        }

        return productInfoSelectors;
    }

    private async getNumPages(browser: Browser, siteInfo: any): Promise<number> {
        const { numPageSelectors, extractUrl } = siteInfo;
        const { numProductSelectorType, numProductSelector, productCardSelector } = numPageSelectors;

        const initialUrl = extractUrl.replace("PAGE_NUM", "1");

        const page = await this.puppeteer.gotoNewPage(browser, initialUrl);

        if(!page) throw new Error("Couldnt go to new page.");

        let numPages;
        switch (numProductSelectorType) {
            case "pagination":
                numPages = await this.elemExtraction.getPaginationNumber(page, numProductSelector);
                break;
            case "total":
                const numProductPerPage = await this.elemExtraction.listLength(page, productCardSelector);
                numPages = await this.elemExtraction.getProductsCountNumber(page, numProductSelector, numProductPerPage);
                break;
        }

        await page.close();

        if(!numPages) throw new Error("Couldnt get number of pages!");

        return numPages;
    }
}

export default ProductExtraction;
