import { inject, injectable } from "inversify";
import MySqlConnection from "../../connection";
import { DataTypes, Model, ModelStatic, Sequelize } from "sequelize";
import PriceModel from "../Price";

@injectable()
class Catalog {
    private readonly conn: Sequelize | undefined;

    private model: ModelStatic<Model> | undefined;

    constructor(
        @inject(MySqlConnection) private mySqlConn: MySqlConnection,
        @inject(PriceModel) private priceModel:PriceModel 
    ) { 
        this.conn = this.mySqlConn.mainConn;
    }

    private async create() {
        if (!this.conn) throw new Error("MySql database not inicialized. Not possible to create a model.");

        const priceModelInstance = await this.priceModel.getModel();

        if(!priceModelInstance) throw new Error("Could not get price model instance.");

        const model = this.conn.define(
            'Catalog',
            {
                url: {
                    type: DataTypes.STRING,
                    unique: true
                },
                type: {
                    type: DataTypes.STRING,
                },
                name: {
                    type: DataTypes.STRING
                },
                site: {
                    type: DataTypes.STRING,
                },
                model: {
                    type: DataTypes.STRING,
                },
                vram: {
                    type: DataTypes.STRING,
                },
                sram: {
                    type: DataTypes.STRING,
                },
                family: {
                    type: DataTypes.STRING,
                },
            },
            {
                freezeTableName: true
            }
        );

        model.hasMany(priceModelInstance, { sourceKey: 'url', foreignKey: 'catalogUrl'})

        await model.sync();

        this.model = model;
    }

    async getModel() {
        if(!this.model) await this.create();
        return this.model;
    }
}

export default Catalog;
