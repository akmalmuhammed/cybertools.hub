export interface SubnetInfo {
    ip: string
    cidr: number
    netmask: string
    networkAddress: string
    broadcastAddress: string
    firstHost: string
    lastHost: string
    totalHosts: number
    usableHosts: number
}

function ipToLong(ip: string): number {
    let parts = ip.split('.');
    if (parts.length !== 4) throw new Error("Invalid IP address");
    return parts.reduce((acc, part) => {
        let val = parseInt(part, 10);
        if (isNaN(val) || val < 0 || val > 255) throw new Error("Invalid IP address");
        return (acc << 8) + val;
    }, 0) >>> 0;
}

function longToIp(long: number): string {
    return [
        (long >>> 24) & 0xFF,
        (long >>> 16) & 0xFF,
        (long >>> 8) & 0xFF,
        long & 0xFF
    ].join('.');
}

export function calculateSubnet(ip: string, cidr: number): SubnetInfo {
    if (cidr < 0 || cidr > 32) throw new Error("Invalid CIDR");

    const ipLong = ipToLong(ip);
    const maskLong = (0xFFFFFFFF << (32 - cidr)) >>> 0;
    const networkLong = (ipLong & maskLong) >>> 0;
    const broadcastLong = (networkLong | (~maskLong & 0xFFFFFFFF)) >>> 0;

    const totalHosts = Math.pow(2, 32 - cidr);
    const usableHosts = cidr === 32 ? 1 : cidr === 31 ? 2 : totalHosts - 2;

    const firstHostLong = (networkLong + 1) >>> 0;
    const lastHostLong = (broadcastLong - 1) >>> 0;

    return {
        ip,
        cidr,
        netmask: longToIp(maskLong),
        networkAddress: longToIp(networkLong),
        broadcastAddress: longToIp(broadcastLong),
        firstHost: cidr > 30 ? "N/A" : longToIp(firstHostLong),
        lastHost: cidr > 30 ? "N/A" : longToIp(lastHostLong),
        totalHosts,
        usableHosts: usableHosts < 0 ? 0 : usableHosts
    };
}

export function ipToDecimal(ip: string): number {
    return ipToLong(ip);
}

export function decimalToIp(decimal: number): string {
    return longToIp(decimal);
}
