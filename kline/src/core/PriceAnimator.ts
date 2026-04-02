export class PriceAnimator {
    private visualLastPrice: number | null = null;

    public update(actualPrice: number, requestRedraw: () => void): number {
        if (this.visualLastPrice === null) {
            this.visualLastPrice = actualPrice;
        } else {
            const diff = actualPrice - this.visualLastPrice;
            if (Math.abs(diff) > 0.0001) {
                this.visualLastPrice += diff * 0.2;
                requestRedraw();
            } else {
                this.visualLastPrice = actualPrice;
            }
        }
        return this.visualLastPrice;
    }

    public getVisualPrice(): number {
        return this.visualLastPrice || 0;
    }
}
