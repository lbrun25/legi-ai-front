import fetch from 'node-fetch'; // S'assurer que c'est un import ES Module
import * as cheerio from 'cheerio';
import { CheerioAPI } from 'cheerio';
import { promises as fs } from 'fs'; // Utiliser les promesses directement

export function formatSection(title: string, content: string): string {
    switch (title) {
        case 'Entête':
            return formatHeader(content, title);
        case 'Exposé du litige':
            return formatLitigation(content, title);
        case 'Moyens':
            return formatMoyens(content, title);
        case 'Motivation':
            return formatMotivation(content, title);
        case 'Dispositif':
            return formatDispositif(content, title);
        case 'Moyens annexés':
            return ''; // On ne l'inclut pas dans le texte principal
        default:
            console.log(`Section non reconnue : ${title}`);
            return '';
    }
}

function formatHeader(header: any, title: string) {
    header = header.replace(/\n+/g, '\n') // Replace multiple newlines with a single one
                   .replace(/\[[^\]]{2,}\]/g, '') // Remove text within brackets
                   .replace(/■|\*|_/g, '') // Remove special characters
                   .replace(/\n\s*\n/g, '\n'); // Replace multiple newlines with a single newline
    const firstLine = header.split('\n')[0]; // Get the first line of the header
    if (firstLine.trim() === title) {
        header = header.replace(firstLine, firstLine.toUpperCase() + ":"); // Convert to uppercase if it matches the title and add "::"
    }
    return header + "\n\n";
}

function formatLitigation(litigation: any, title: string) {
    litigation = litigation.replace(/\n+/g, '\n')
                           .replace(/\[[^\]]{2,}\]/g, '')
                           .replace(/■|\*|_/g, '')
                           .replace(/\n\s*\n/g, '\n');
    const firstLine = litigation.split('\n')[0]; // Get the first line of the litigation
    if (firstLine.trim() === title) {
        litigation = litigation.replace(firstLine, firstLine.toUpperCase() + ":"); // Convert to uppercase if it matches the title and add "::"
    }
    return litigation + "\n\n";
}

function formatMoyens(moyens: any, title: string) {
    moyens = moyens.replace(/\n+/g, '\n')
                   .replace(/\[[^\]]{2,}\]/g, '')
                   .replace(/■|\*|_/g, '')
                   .replace(/\n\s*\n/g, '\n');
    const firstLine = moyens.split('\n')[0]; // Get the first line of the moyens
    if (firstLine.trim() === title) {
        moyens = moyens.replace(firstLine, firstLine.toUpperCase() + ":"); // Convert to uppercase if it matches the title and add "::"
    }
    return moyens + "\n\n";
}

function formatMotivation(motivation: any, title: string) {
    motivation = motivation.replace(/\n+/g, '\n')
                           .replace(/\[[^\]]{2,}\]/g, '')
                           .replace(/■|\*|_/g, '')
                           .replace(/\n\s*\n/g, '\n');
    const firstLine = motivation.split('\n')[0]; // Get the first line of the motivation
    if (firstLine.trim() === title) {
        motivation = motivation.replace(firstLine, firstLine.toUpperCase() + ":"); // Convert to uppercase if it matches the title and add "::"
    }
    return motivation + "\n\n";
}

function formatDispositif(dispositif: any, title: string) {
    dispositif = dispositif.replace(/\n+/g, '\n')
                           .replace(/\[[^\]]{2,}\]/g, '')
                           .replace(/■|\*|_/g, '')
                           .replace(/\n\s*\n/g, '\n');
    const firstLine = dispositif.split('\n')[0]; // Get the first line of the dispositif
    if (firstLine.trim() === title) {
        dispositif = dispositif.replace(firstLine, firstLine.toUpperCase() + ":"); // Convert to uppercase if it matches the title and add "::"
    }
    return dispositif + "\n\n";
}

function formatAnnexe(annexe: string, title: string): string {
    annexe = annexe.replace(/\n+/g, '\n') // Replace multiple newlines with a single one
                   .replace(/\[[^\]]{2,}\]/g, '') // Remove text within brackets
                   .replace(/■|\*|_/g, '') // Remove special characters
                   .replace(/\n\s*\n/g, '\n'); // Replace multiple newlines with a single newline
    const firstLine = annexe.split('\n')[0]; // Get the first line of the annexe
    if (firstLine.trim() === title) {
        annexe = annexe.replace(firstLine, firstLine.toUpperCase() + ":"); // Convert to uppercase if it matches the title and add "::"
    }
    return annexe + "\n\n";
}

export function formatSectionWithAnnexe(title: string, content: string): string {
    switch (title) {
        case 'Entête':
            return formatHeader(content, title);
        case 'Exposé du litige':
            return formatLitigation(content, title);
        case 'Moyens':
            return formatMoyens(content, title);
        case 'Motivation':
            return formatMotivation(content, title);
        case 'Dispositif':
            return formatDispositif(content, title);
        case 'Moyens annexés':
            return formatAnnexe(content, title);
        default:
            console.log(`Section non reconnue : ${title}`);
            return '';
    }
}
