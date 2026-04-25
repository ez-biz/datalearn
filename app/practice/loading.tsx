import { Container } from "@/components/ui/Container"
import { Card } from "@/components/ui/Card"
import { Skeleton } from "@/components/ui/Skeleton"

export default function PracticeLoading() {
    return (
        <Container width="lg" className="py-10 sm:py-14">
            <div className="mb-8 space-y-3">
                <Skeleton className="h-9 w-40" />
                <Skeleton className="h-4 w-96 max-w-full" />
            </div>
            <div className="flex gap-3 mb-5">
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 w-72 hidden sm:block" />
            </div>
            <Card className="overflow-hidden divide-y divide-border">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div
                        key={i}
                        className="grid grid-cols-[3rem_1fr_8rem_3rem] items-center gap-4 px-6 py-4"
                    >
                        <Skeleton className="h-3 w-6" />
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-1/2" />
                            <Skeleton className="h-3 w-3/4" />
                        </div>
                        <Skeleton className="h-5 w-16 rounded-full" />
                        <Skeleton className="h-4 w-4 ml-auto" />
                    </div>
                ))}
            </Card>
        </Container>
    )
}
