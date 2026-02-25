import { useState } from "react"
import { ToolTemplate } from "@/components/tools/ToolTemplate"
import { generatePassword } from "@/lib/utils/crypto"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"

export default function PasswordGenTool() {
    const [length, setLength] = useState(16)
    const [options, setOptions] = useState({
        uppercase: true,
        lowercase: true,
        numbers: true,
        symbols: true
    })

    const process = () => {
        return generatePassword(length, options)
    }

    return (
        <ToolTemplate
            toolName="Password Generator"
            description="Generate strong, secure passwords locally."
            actionLabel="Generate"
            placeholder="Click Generate to create a password (input text is ignored)"
            requiresInput={false}
            controls={
                <div className="space-y-4 p-4 border rounded-md">
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium">Length: {length}</label>
                        <Slider
                            value={[length]}
                            min={8}
                            max={64}
                            step={1}
                            onValueChange={(vals) => setLength(vals[0])}
                            className="w-full"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="uppercase"
                                checked={options.uppercase}
                                onCheckedChange={(checked) => setOptions(prev => ({ ...prev, uppercase: !!checked }))}
                            />
                            <label htmlFor="uppercase" className="text-sm font-medium leading-none cursor-pointer">
                                Uppercase (A-Z)
                            </label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="lowercase"
                                checked={options.lowercase}
                                onCheckedChange={(checked) => setOptions(prev => ({ ...prev, lowercase: !!checked }))}
                            />
                            <label htmlFor="lowercase" className="text-sm font-medium leading-none cursor-pointer">
                                Lowercase (a-z)
                            </label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="numbers"
                                checked={options.numbers}
                                onCheckedChange={(checked) => setOptions(prev => ({ ...prev, numbers: !!checked }))}
                            />
                            <label htmlFor="numbers" className="text-sm font-medium leading-none cursor-pointer">
                                Numbers (0-9)
                            </label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="symbols"
                                checked={options.symbols}
                                onCheckedChange={(checked) => setOptions(prev => ({ ...prev, symbols: !!checked }))}
                            />
                            <label htmlFor="symbols" className="text-sm font-medium leading-none cursor-pointer">
                                Symbols (!@#$)
                            </label>
                        </div>
                    </div>
                </div>
            }
            onProcess={process}
        />
    )
}
