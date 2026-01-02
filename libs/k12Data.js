// libs/k12Data.js

export const K12_SCHOOLS = [
    // NYC Specialized High Schools
    { id: 155694, name: "Stuyvesant High School", city: "New York, NY", weight: 100 },
    { id: 156251, name: "Bronx High School Of Science", city: "Bronx, NY", weight: 98 },
    { id: 157582, name: "Brooklyn Technical High School", city: "Brooklyn, NY", weight: 95 },
    { id: 155770, name: "Staten Island Technical High School", city: "Staten Island, NY", weight: 90 },
    { id: 158162, name: "Townsend Harris High School", city: "Flushing, NY", weight: 88 },
    // Chicago Selective Enrollment
    { id: 3521141, name: "Walter Payton College Preparatory High School", city: "Chicago, IL", weight: 95 },
    { id: 3521074, name: "Whitney M Young Magnet High School", city: "Chicago, IL", weight: 92 },
    { id: 219471, name: "Northside College Preparatory High School", city: "Chicago, IL", weight: 88 },
    { id: 219254, name: "Lane Technical High School", city: "Chicago, IL", weight: 85 },
    // Virginia / DC STEM
    { id: 3704245, name: "Thomas Jefferson High School For Science And Technology", city: "Alexandria, VA", weight: 100 },
    { id: 167407, name: "McKinley Technology High School", city: "Washington, DC", weight: 85 },
    // California Elite
    { id: 3539252, name: "Gretchen Whitney High School", city: "Cerritos, CA", weight: 95 },
    { id: 262338, name: "Lowell High School (San Francisco)", city: "San Francisco, CA", weight: 90 },
    { id: 262370, name: "Palo Alto High School", city: "Palo Alto, CA", weight: 88 },
    { id: 262410, name: "Gunn (Henry M.) High School", city: "Palo Alto, CA", weight: 85 },
    // Top 50 US - Verified
    { id: 202063, name: "Signature School Inc", city: "Evansville, IN", weight: 95 },
    { id: 183857, name: "School For Advanced Studies Homestead", city: "Homestead, FL", weight: 92 },
    { id: 3506727, name: "Loveless Academic Magnet Program High School (LAMP)", city: "Montgomery, AL", weight: 90 },
    { id: 178685, name: "Gwinnett School Of Mathematics, Science And Technology", city: "Lawrenceville, GA", weight: 88 },
    { id: 174195, name: "North Carolina School of Science and Mathematics", city: "Durham, NC", weight: 90 },
    { id: 3520767, name: "Il Mathematics And Science Academy", city: "Aurora, IL", weight: 92 }
];

export function getRandomSchool() {
    // Weighted random selection
    const totalWeight = K12_SCHOOLS.reduce((sum, school) => sum + school.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const school of K12_SCHOOLS) {
        if (random < school.weight) {
            return school;
        }
        random -= school.weight;
    }
    return K12_SCHOOLS[0];
}