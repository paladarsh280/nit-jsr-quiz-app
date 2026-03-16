import { PremiumLoader } from "@/components/ui/PremiumLoader";

export default function Loading() {
    return (
        <div className="w-full min-h-[50vh] flex items-center justify-center">
            <PremiumLoader text="Navigating..." />
        </div>
    );
}
